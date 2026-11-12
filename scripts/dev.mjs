import { cancel, isCancel, log, multiselect, select } from '@clack/prompts';
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { createScreen, describeServer } from './dev-screen.mjs';
import {
	connectToService,
	convex,
	createSignInLink,
	currentBranch,
	deploymentReadyMarker,
	frontendScripts,
	idleStopDelay,
	listServers,
	logPath,
	onMessages,
	requestState,
	runService,
	send,
	signIn,
	stopServers,
	stopTimeout
} from './dev-service.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const commands = new Set(['restart', 'stop', 'servers', ...(signIn ? ['sign-in'] : [])]);
const frontendKeys = Object.keys(frontendScripts);
const supportedFlags = new Set([
	...frontendKeys.map((key) => `--${key}`),
	...(convex ? ['--no-typecheck'] : [])
]);

function printHelp() {
	const nameWidth = Math.max(...frontendKeys.map((key) => key.length));
	console.log(`Run the development environment.

Usage:
  pnpm dev [options]   Start this worktree's dev server if it isn't running, then watch it
  pnpm dev restart     Restart this worktree's dev server on the same ports
  pnpm dev stop        Stop this worktree's dev server
  pnpm dev servers     Pick dev servers in any worktree to stop${
		signIn
			? `
  pnpm dev sign-in [user] [path]  Print a five-minute sign-in link to this
                   worktree's ${frontendScripts[signIn.frontend].name}. Signs in as [user], or the
                   default user, and lands on [path] (default /)`
			: ''
	}

Frontend options:
${frontendKeys.map((key) => `  --${key.padEnd(nameWidth)}  Run ${frontendScripts[key].name}`).join('\n')}

Other options:${convex ? '\n  --no-typecheck  Disable Convex typechecking while watching' : ''}
  -h, --help      Show this help menu

The dev server runs in the background, one per worktree: ${convex ? 'Convex plus every\nfrontend asked for' : 'every frontend asked\nfor'}. Each \`pnpm dev\` watches it, and frontend options add
frontends that aren't running yet. Ctrl-C stops watching; the server stops 30
seconds after nobody is watching it. It also stops, even while watched, after 4
hours without a \`pnpm dev\` command${convex ? ' or a Convex call from a browser or the CLI' : ''}.

Run without frontend options to choose with an interactive multi-select when
the server isn't running yet.`);
}

function parseOptions(args) {
	const command = args.find((argument) => commands.has(argument));
	// sign-in takes an optional user ID and path, told apart by the path's
	// leading /.
	const operands = command === 'sign-in' ? args.slice(args.indexOf(command) + 1).slice(0, 2) : [];
	const unknownArguments = args.filter(
		(argument) =>
			!supportedFlags.has(argument) &&
			!commands.has(argument) &&
			!operands.includes(argument) &&
			argument !== '--' &&
			argument !== '--help' &&
			argument !== '-h'
	);
	if (unknownArguments.length > 0) {
		console.error(
			`Unknown option${unknownArguments.length === 1 ? '' : 's'}: ${unknownArguments.join(', ')}\n`
		);
		printHelp();
		process.exit(1);
	}

	return {
		command,
		path: operands.find((operand) => operand.startsWith('/')),
		userId: operands.find((operand) => !operand.startsWith('/')),
		frontends: frontendKeys.filter((key) => args.includes(`--${key}`)),
		noTypecheck: args.includes('--no-typecheck')
	};
}

async function promptForFrontends() {
	if (frontendKeys.length === 1) return frontendKeys;
	if (!process.stdin.isTTY) {
		console.error(
			`Choose a frontend with ${frontendKeys.map((key) => `--${key}`).join(', ')} when input is not interactive.\n`
		);
		printHelp();
		process.exit(1);
	}

	const selectedFrontends = await multiselect({
		message: 'Which frontends should run?',
		options: frontendKeys.map((key) => ({ value: key, label: frontendScripts[key].name })),
		required: true
	});

	if (isCancel(selectedFrontends)) {
		cancel('Development environment not started.');
		process.exit(0);
	}

	return selectedFrontends;
}

function assertBranchDeploymentReady() {
	if (!deploymentReadyMarker) return;
	const branch = currentBranch(projectRoot);
	if (!branch || ['dev', 'main', 'master'].includes(branch)) return;
	const marker = join(projectRoot, deploymentReadyMarker);
	if (existsSync(marker)) return;

	const hasDeployment = existsSync(join(dirname(marker), '.env.local'));
	console.error(
		hasDeployment
			? `The Convex deployment for ${branch} is still being set up. Starting now would push functions while its setup is in flight.`
			: `${branch} has no Convex deployment yet, so \`convex dev\` would fall back to your personal dev deployment and this worktree would share it.`
	);
	console.error('Wait for the worktree setup to finish.\n');
	process.exit(1);
}

async function startService(noTypecheck) {
	// Appended, since another run's service may already be writing to it; the
	// service that wins the socket empties it.
	const serviceLog = openSync(logPath(projectRoot), 'a');
	const service = spawn(
		process.execPath,
		[fileURLToPath(import.meta.url), '--service', ...(noTypecheck ? ['--no-typecheck'] : [])],
		{ cwd: projectRoot, detached: true, stdio: ['ignore', serviceLog, serviceLog] }
	);
	service.unref();
	let exited = false;
	service.once('exit', () => (exited = true));

	for (let attempt = 0; attempt < 600; attempt++) {
		const socket = await connectToService(projectRoot);
		if (socket) return socket;
		// Checked after connecting: a service that lost the race to another
		// `pnpm dev` exits too, and the winner's socket answers.
		if (exited) break;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	// The end of the log, since it may or may not have been emptied by a
	// service that started, and the error is last either way.
	console.error(`The dev server didn't start. The end of its output:\n`);
	console.error(readFileSync(logPath(projectRoot), 'utf8').split('\n').slice(-40).join('\n'));
	process.exit(1);
}

function describeUrls(state) {
	const lines = [`Dev server for ${state.branch} (pid ${state.pid}):`];
	for (const { name, urls } of state.frontends) {
		lines.push(
			`  ${name}: ${urls ? [urls.https, urls.tailscale, urls.local].filter(Boolean).join('  ') : 'starting…'}`
		);
	}
	return `${lines.join('\n')}\n`;
}

async function watch(socket) {
	let latestState;
	// Stays 1 if the connection drops without the service saying why.
	let stoppedExitCode = 1;
	const detach = () => {
		screen?.close();
		socket.destroy();
		// The state counts this terminal as one of the watchers.
		const others = (latestState?.watchers ?? 1) - 1;
		console.log(
			others > 0
				? `Detached from ${latestState.branch}. ${others} other ${others === 1 ? 'terminal is' : 'terminals are'} still watching, so the dev server keeps running.`
				: `Detached from ${latestState?.branch ?? 'the dev server'}. Nothing else is watching, so the dev server stops in ${idleStopDelay / 1000} seconds unless \`pnpm dev\` runs again.`
		);
		process.exit(0);
	};
	// Agents and other non-interactive runs get plain output and the URLs.
	const screen =
		process.stdin.isTTY && process.stdout.isTTY
			? createScreen({
					projectRoot,
					allFrontends: frontendScripts,
					onDetach: detach,
					onAction: ({ action, frontend }) =>
						send(
							socket,
							action === 'add' ? { type: 'add', frontends: [frontend] } : { type: action }
						)
				})
			: undefined;
	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, detach);

	let described;
	onMessages(socket, (message) => {
		if (message.type === 'output') {
			if (screen) screen.write(message.data);
			else process.stdout.write(stripVTControlCharacters(message.data));
		}
		if (message.type === 'stopped') stoppedExitCode = message.exitCode;
		if (message.type === 'state') {
			latestState = message.state;
			if (screen) return screen.setState(message.state);
			const description = describeUrls(message.state);
			if (description !== described) process.stdout.write(description);
			described = description;
		}
	});
	socket.once('close', () => {
		if (screen) {
			// Leaving the full-screen view takes its output with it, so keep the
			// end of it, which says why the server stopped.
			const recent = screen.tail(20);
			screen.close();
			if (recent.length > 0) console.log(`${recent.join('\n')}\x1b[0m`);
		}
		console.log(`The dev server stopped. Its full output is in ${logPath(projectRoot)}.`);
		process.exit(stoppedExitCode);
	});
	send(socket, { type: 'watch' });
}

async function manageServers() {
	const servers = await listServers(projectRoot);
	if (servers.length === 0) return log.info('No dev servers are running.');
	if (!process.stdin.isTTY) {
		for (const server of servers) {
			const { label, hint } = describeServer(server, projectRoot);
			console.log(`${label}  (${hint})  ${server.root}`);
		}
		return;
	}

	const selected = await multiselect({
		message: 'Dev servers on this machine',
		options: servers.map((server) => ({
			value: server.root,
			...describeServer(server, projectRoot)
		})),
		required: false
	});
	if (isCancel(selected)) return;
	const action = await select({
		message: 'Stop servers?',
		// Cancel is the default, so an accidental Enter stops nothing.
		initialValue: 'cancel',
		options: [
			{ value: 'cancel', label: 'Cancel' },
			...(selected.length > 0
				? [{ value: 'selected', label: `Stop selected (${selected.length})` }]
				: []),
			{ value: 'all', label: `Stop all (${servers.length})` }
		]
	});
	if (isCancel(action) || action === 'cancel') return;

	const targets = action === 'all' ? servers.map(({ root }) => root) : selected;
	const stuck = await stopServers(targets);
	const stopped = targets.length - stuck.length;
	if (stopped > 0) log.success(`Stopped ${stopped} dev server${stopped === 1 ? '' : 's'}.`);
	for (const root of stuck) log.warn(`${root} didn't stop within ${stopTimeout / 1000} seconds.`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
	printHelp();
	process.exit(0);
}

if (args[0] === '--service') {
	await runService(projectRoot, parseOptions(args.slice(1)));
} else {
	const { command, path, userId, frontends, noTypecheck } = parseOptions(args);
	if (command === 'servers') {
		await manageServers();
	} else if (command === 'sign-in') {
		try {
			const state = await requestState(projectRoot);
			if (!state) throw new Error(`No dev server is running for ${currentBranch(projectRoot)}.`);
			const link = await createSignInLink(projectRoot, state, { userId, path });
			console.log(
				`Sign-in link for ${userId ?? 'the default user'} (expires in 5 minutes):\n${link}`
			);
		} catch (error) {
			console.error(error.stderr?.trim() || error.message);
			process.exitCode = 1;
		}
	} else if (command) {
		const socket = await connectToService(projectRoot);
		const branch = currentBranch(projectRoot);
		if (!socket) {
			console.log(`No dev server is running for ${branch}.`);
		} else if (command === 'restart') {
			send(socket, { type: 'restart' });
			socket.end();
			console.log(`Restarting the dev server for ${branch}.`);
		} else {
			socket.end();
			const [stuck] = await stopServers([projectRoot]);
			if (stuck) {
				console.error(
					`The dev server for ${branch} didn't stop within ${stopTimeout / 1000} seconds.`
				);
				process.exitCode = 1;
			} else {
				console.log(`Stopped the dev server for ${branch}.`);
			}
		}
	} else {
		let socket = await connectToService(projectRoot);
		let requested = frontends;
		if (!socket) {
			assertBranchDeploymentReady();
			if (requested.length === 0) requested = await promptForFrontends();
			socket = await startService(noTypecheck);
		}
		// Sent even to a service this run started, since another run may have
		// started it first.
		if (requested.length > 0) send(socket, { type: 'add', frontends: requested });
		await watch(socket);
	}
}
