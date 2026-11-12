import { execFile, execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { ftruncateSync, mkdirSync, rmSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify, stripVTControlCharacters } from 'node:util';

// What this project's dev server runs. Pylon has no backend, so there's no
// Convex CLI to run (`convex` is undefined) and no deployment to wait for. The
// one frontend starts with `pnpm dev` and runs as `pnpm exec vite dev --port
// <port>`. Vite listens on every interface (`server.host` in vite.config.ts)
// so the Tailscale URLs work.
export const convex = undefined;
export const frontendScripts = {
	web: { name: 'Pylon', args: ['exec', 'vite', 'dev'] }
};
export const deploymentReadyMarker = undefined;
// No accounts, so no sign-in links.
export const signIn = undefined;

// A worktree's dev server runs in the background: Convex, when the project has
// it, plus the frontends asked for so far. Every `pnpm dev` watches it over this socket, and it stops
// once nobody has watched it for idleStopDelay. A terminal left watching
// doesn't keep it going past unusedStopDelay without anyone using it.
export const socketPath = (root) => join(root, '.dev-server.sock');
// The service's own stdout and stderr, for agents and for startup failures.
export const logPath = (root) => join(root, '.dev-server.log');
export const idleStopDelay = 30_000;
export const unusedStopDelay = 4 * 60 * 60_000;
// Output kept for watchers that attach later, trimmed to whole lines.
export const historyLimit = 1_000_000;

export function currentBranch(root) {
	return execFileSync('git', ['branch', '--show-current'], {
		cwd: root,
		encoding: 'utf8'
	}).trim();
}

// Messages are newline-delimited JSON in both directions.
export function send(socket, message) {
	socket.write(`${JSON.stringify(message)}\n`);
}

export function onMessages(socket, handle) {
	let buffered = '';
	socket.setEncoding('utf8');
	socket.on('data', (chunk) => {
		buffered += chunk;
		const lines = buffered.split('\n');
		buffered = lines.pop();
		for (const line of lines) if (line) handle(JSON.parse(line));
	});
}

// Resolves to a connected socket, or undefined when no service is listening.
export function connectToService(root) {
	return new Promise((resolve) => {
		const socket = connect(socketPath(root))
			.once('connect', () => resolve(socket))
			.once('error', () => resolve(undefined));
	});
}

export async function requestState(root) {
	const socket = await connectToService(root);
	if (!socket) return;
	return new Promise((resolve) => {
		onMessages(socket, (message) => {
			if (message.type !== 'state') return;
			socket.end();
			resolve(message.state);
		});
		socket.once('close', () => resolve(undefined));
		// A service that doesn't answer counts as not running, so it can't hold
		// up the servers picker.
		socket.setTimeout(1_000, () => socket.destroy());
		send(socket, { type: 'state' });
	});
}

// Every worktree of this repository with a dev server running.
export async function listServers(root) {
	const roots = execFileSync('git', ['worktree', 'list', '--porcelain'], {
		cwd: root,
		encoding: 'utf8'
	})
		.split('\n')
		.filter((line) => line.startsWith('worktree '))
		.map((line) => line.slice('worktree '.length));
	const servers = await Promise.all(
		roots.map(async (root) => ({ root, state: await requestState(root) }))
	);
	return servers.filter(({ state }) => state);
}

// A shutdown takes about 2s at most, before the children are killed.
export const stopTimeout = 15_000;

// Resolves once the services have exited, so a `pnpm dev` right after starts
// a fresh one instead of attaching to one that's shutting down. Returns the
// roots whose service didn't exit within stopTimeout.
export async function stopServers(roots) {
	const stuck = await Promise.all(
		roots.map(async (root) => {
			const socket = await connectToService(root);
			if (!socket) return;
			send(socket, { type: 'stop' });
			const stopped = await Promise.race([
				once(socket.resume(), 'close').then(() => true),
				delay(stopTimeout, false, { ref: false })
			]);
			if (stopped) return;
			socket.destroy();
			return root;
		})
	);
	return stuck.filter(Boolean);
}

// Vite binds 0.0.0.0, so the tailnet reaches it at this machine's Tailscale
// IP, and over HTTPS through `tailscale serve`. Existing mappings put port N
// at HTTPS port N + 3000; a port without one gets one.
async function frontendUrls(port) {
	const urls = { local: `http://localhost:${port}` };
	// Async so the service keeps answering watchers meanwhile, and bounded
	// because `serve` can wait for approval when Serve isn't enabled on the
	// tailnet.
	const tailscale = (args) => promisify(execFile)('tailscale', args, { timeout: 5_000 });
	const read = async (args) => JSON.parse((await tailscale(args)).stdout);
	try {
		const { Self } = await read(['status', '--json']);
		const web = (await read(['serve', 'status', '--json'])).Web ?? {};
		urls.tailscale = `http://${Self.TailscaleIPs[0]}:${port}`;
		const target = `http://127.0.0.1:${port}`;
		let host = Object.keys(web).find((host) =>
			Object.values(web[host].Handlers ?? {}).some(({ Proxy }) => Proxy === target)
		);
		if (!host) {
			const candidate = `${Self.DNSName.replace(/\.$/, '')}:${port + 3000}`;
			if (!web[candidate]) {
				await tailscale(['serve', '--bg', `--https=${port + 3000}`, target]);
				host = candidate;
			}
		}
		if (host) urls.https = `https://${host}`;
	} catch {
		// Tailscale isn't installed or running here.
	}
	return urls;
}

// A sign-in link to this dev server's frontend, for the screen's button and
// `pnpm dev sign-in`. Convex builds it on the site URL in its env, which isn't
// this worktree's port, so it moves onto the frontend's own URL. `path` is
// where it lands after signing in.
export async function createSignInLink(root, state, { userId, path = '/' } = {}) {
	const { name } = frontendScripts[signIn.frontend];
	const frontend = state.frontends.find(({ key }) => key === signIn.frontend);
	if (!frontend)
		throw new Error(
			`${name} isn't running on this dev server. Add it with \`pnpm dev --${signIn.frontend}\`.`
		);
	if (!frontend.urls) throw new Error(`${name} is still starting.`);
	const { stdout } = await promisify(execFile)(
		'pnpm',
		[
			...convex,
			'run',
			signIn.convexFunction,
			JSON.stringify({ successUrl: path, ...(userId && { userId }) })
		],
		{ cwd: root }
	);
	const link = new URL(JSON.parse(stdout.trim().split('\n').at(-1)));
	const { urls } = frontend;
	return new URL(`${link.pathname}${link.search}`, urls.https ?? urls.tailscale ?? urls.local).href;
}

export async function runService(root, { noTypecheck }) {
	const watchers = new Set();
	let history = '';
	const emit = (data) => {
		process.stdout.write(data);
		history += data;
		if (history.length > historyLimit) {
			history = history.slice(history.indexOf('\n', history.length - historyLimit) + 1);
		}
		for (const watcher of watchers) send(watcher, { type: 'output', data });
	};
	const startedAt = Date.now();
	let restarting = false;
	let shuttingDown = false;
	// Set while children are being stopped on purpose, so their exits don't
	// read as crashes.
	let stopping = false;
	const children = new Set();
	const running = new Map();

	const state = () => ({
		pid: process.pid,
		branch: currentBranch(root),
		startedAt,
		restarting,
		watchers: watchers.size,
		frontends: [...running].map(([key, { name, port, urls }]) => ({ key, name, port, urls }))
	});
	const broadcastState = () => {
		const current = state();
		for (const watcher of watchers) send(watcher, { type: 'state', state: current });
	};

	const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
	// A child whose stdout is data rather than output hands it to readStdout.
	function startChild(name, args, onOutput, readStdout) {
		// Shutdown has already collected the children it stops.
		if (shuttingDown) return;
		// Each child leads its own process group so stopping it reaches Vite and
		// Convex under pnpm.
		const child = spawn(pnpmCommand, args, {
			cwd: root,
			stdio: ['ignore', 'pipe', 'pipe'],
			// Output is piped to watchers, so the children can't detect a terminal.
			env: { ...process.env, FORCE_COLOR: '1' },
			detached: true
		});
		// Once stopped on purpose, pnpm only reports the signal as a failure.
		const forward = (data) => {
			if (stopping) return;
			emit(data);
			onOutput?.(data);
		};
		if (readStdout) readStdout(child.stdout);
		else child.stdout.setEncoding('utf8').on('data', forward);
		child.stderr.setEncoding('utf8').on('data', forward);
		child.once('error', (error) => {
			emit(`Failed to start ${name}: ${error.message}\n`);
			shutDown(1);
		});
		child.once('close', (code, signal) => {
			children.delete(child);
			if (stopping) return;
			const reason = signal ? `signal ${signal}` : `exit code ${code}`;
			emit(`${name} stopped with ${reason}; stopping the dev server.\n`);
			shutDown(1);
		});
		children.add(child);
	}

	const signalChildren = (signal) => {
		for (const child of children) {
			try {
				process.kill(-child.pid, signal);
			} catch {
				// Already gone.
			}
		}
	};
	async function stopChildren() {
		stopping = true;
		const closed = [...children].map((child) => once(child, 'close'));
		signalChildren('SIGTERM');
		const forceStop = setTimeout(() => signalChildren('SIGKILL'), 2_000);
		await Promise.all(closed);
		clearTimeout(forceStop);
	}

	// Convex labels every function run with what called it. Browsers
	// (SyncWorker) and HTTP clients like the CLI (HttpApi) mean someone is using
	// the deployment; crons, the scheduler, and webhooks don't.
	const startConvex = () => {
		if (!convex) return;
		startChild('Convex', [...convex, 'dev', ...(noTypecheck ? ['--typecheck=disable'] : [])]);
		startChild('Convex logs', [...convex, 'logs', '--jsonl'], undefined, (stdout) =>
			onMessages(stdout, ({ caller }) => {
				if (caller === 'SyncWorker' || caller === 'HttpApi') markUsed();
			})
		);
	};

	// Vite moves to the next port when the one asked for is taken, which can't
	// collide with another worktree, so the port is read from what it prints.
	// A restart asks for the same port again.
	function startFrontend(key, requestedPort = 5173) {
		const { name, args } = frontendScripts[key];
		const frontend = { name, requestedPort };
		running.set(key, frontend);
		let printed = '';
		startChild(name, [...args, '--port', String(requestedPort)], async (data) => {
			if (frontend.port) return;
			printed += stripVTControlCharacters(data);
			const port = printed.match(/Local:\s+http:\/\/localhost:(\d+)/)?.[1];
			if (!port) return;
			frontend.port = Number(port);
			frontend.urls = { local: `http://localhost:${port}` };
			broadcastState();
			frontend.urls = await frontendUrls(frontend.port);
			broadcastState();
		});
	}

	function addFrontends(keys) {
		for (const key of keys) {
			if (!running.has(key) && frontendScripts[key]) startFrontend(key);
		}
		broadcastState();
	}

	async function restart() {
		if (restarting || shuttingDown) return;
		restarting = true;
		broadcastState();
		emit('Restarting the dev server.\n');
		await stopChildren();
		// A stop that arrived mid-restart is already shutting down.
		if (shuttingDown) return;
		stopping = false;
		startConvex();
		for (const [key, { port, requestedPort }] of running) startFrontend(key, port ?? requestedPort);
		restarting = false;
		broadcastState();
	}

	// Adds and restarts run one at a time, so two can't start the same
	// frontend.
	let queue = Promise.resolve();
	const enqueue = (task) => (queue = queue.then(task));

	// A crash exits 1 and an intentional or idle stop 0. Watchers exit with
	// the same code, so agents can tell the environment failed.
	async function shutDown(exitCode = 0) {
		if (shuttingDown) return;
		shuttingDown = true;
		emit('Stopping the dev server.\n');
		await stopChildren();
		for (const watcher of watchers) {
			send(watcher, { type: 'stopped', exitCode });
			watcher.end();
		}
		// Also removes the socket file.
		server.close();
		process.exit(exitCode);
	}

	let idleTimer;
	const scheduleIdleStop = () => {
		clearTimeout(idleTimer);
		if (watchers.size === 0) idleTimer = setTimeout(() => shutDown(), idleStopDelay);
	};

	let unusedTimer;
	const markUsed = () => {
		clearTimeout(unusedTimer);
		unusedTimer = setTimeout(() => {
			emit(`Nothing has used the dev server for ${unusedStopDelay / 3_600_000} hours.\n`);
			shutDown();
		}, unusedStopDelay);
	};

	const server = createServer((socket) => {
		socket.on('error', () => {});
		onMessages(socket, (message) => {
			// The servers picker asks every worktree for its state, so that alone
			// isn't using this one.
			if (message.type === 'state') send(socket, { type: 'state', state: state() });
			else markUsed();
			if (message.type === 'watch') {
				// Sent in the same tick the watcher joins, so nothing is missed or
				// repeated between the history and live output.
				if (history) send(socket, { type: 'output', data: history });
				watchers.add(socket);
				socket.once('close', () => {
					watchers.delete(socket);
					broadcastState();
					scheduleIdleStop();
				});
				clearTimeout(idleTimer);
				broadcastState();
			}
			if (message.type === 'add') enqueue(() => addFrontends(message.frontends));
			if (message.type === 'restart') enqueue(restart);
			if (message.type === 'stop') shutDown();
		});
	});

	const listen = () =>
		new Promise((resolve, reject) => {
			server.once('error', reject).listen(socketPath(root), () => {
				server.off('error', reject);
				resolve();
			});
		});
	try {
		await listen();
	} catch {
		// The socket file belongs to a running service or to one that was
		// killed. Only one starter at a time checks and replaces it; two could
		// otherwise each remove the other's new socket and both run. A lock left
		// by a starter killed mid-check is taken over after 2 seconds.
		const lock = `${socketPath(root)}.lock`;
		for (let attempt = 0; ; attempt++) {
			try {
				mkdirSync(lock);
				break;
			} catch {
				if (attempt === 80) rmSync(lock, { recursive: true, force: true });
				await delay(25);
			}
		}
		let started = false;
		try {
			const other = await connectToService(root);
			if (other) {
				// Another `pnpm dev` started this worktree's service first.
				other.end();
			} else {
				rmSync(socketPath(root), { force: true });
				await listen();
				started = true;
			}
		} finally {
			rmSync(lock, { recursive: true, force: true });
		}
		if (!started) process.exit(0);
	}
	// The log (this process's stdout, opened for appending) starts fresh now
	// that this service is the one running.
	ftruncateSync(1, 0);

	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => shutDown());
	// The children lead their own process groups, so a crash here would
	// otherwise leave them running, and a socket left behind would make the
	// next start recover it.
	process.on('exit', () => {
		signalChildren('SIGKILL');
		if (server.listening) server.close();
	});
	startConvex();
	scheduleIdleStop();
	markUsed();
}
