import { styleText } from 'node:util';
import {
	createSignInLink,
	historyLimit,
	listServers,
	signIn as signInConfig,
	stopServers
} from './dev-service.mjs';

export function formatDuration(milliseconds) {
	const minutes = Math.floor(milliseconds / 60_000);
	if (minutes < 1) return `${Math.floor(milliseconds / 1000)}s`;
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours}h ${minutes % 60}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function describeServer({ root, state }, projectRoot) {
	return {
		label: `${state.branch}  ${state.frontends.map(({ name, port }) => `${name} ${port ? `:${port}` : '(starting)'}`).join(' · ')}`,
		hint: `${state.watchers} watching · up ${formatDuration(Date.now() - state.startedAt)}${root === projectRoot ? ' · this worktree' : ''}`
	};
}

// OSC 8 makes the text a link even where the terminal wouldn't detect it, and
// the URL stays clickable when a narrow terminal cuts the text off.
const link = (url) => `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`;

const reset = '\x1b[0m';
const idleButton = '\x1b[48;5;237m';
const focusedButton = '\x1b[44;97m';
const keyNames = {
	'\x1b[A': 'up',
	'\x1bOA': 'up',
	'\x1b[B': 'down',
	'\x1bOB': 'down',
	'\x1b[C': 'right',
	'\x1bOC': 'right',
	'\x1b[D': 'left',
	'\x1bOD': 'left',
	'\t': 'right',
	'\x1b[Z': 'left',
	'\x1b[5~': 'page-up',
	'\x1b[6~': 'page-down',
	'\x1b[H': 'home',
	'\x1bOH': 'home',
	'\x1b[1~': 'home',
	'\x1b[F': 'end',
	'\x1bOF': 'end',
	'\x1b[4~': 'end',
	'\r': 'enter',
	'\x1b': 'escape',
	'\x03': 'ctrl-c',
	' ': 'space'
};

// Keeps colors from a log line and drops everything that moves the cursor,
// since the screen decides where each line goes. A carriage return means the
// line was redrawn, so only its last version counts.
function cleanLogLine(line) {
	return line
		.slice(line.replace(/\r+$/, '').lastIndexOf('\r') + 1)
		.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, (sequence) => (sequence.endsWith('m') ? sequence : ''))
		.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
		.replace(/\x1b[^[]/g, '')
		.replace(/\t/g, '  ')
		.replace(/[\r\x00-\x08\x0b-\x1a\x1c-\x1f]/g, '');
}

// Splits a cleaned line into rows of `width` columns, carrying the active
// color onto each continuation row.
function wrapLogLine(line, width) {
	const rows = [];
	let row = '';
	let count = 0;
	let style = '';
	for (const [token] of line.matchAll(/\x1b\[[0-9;]*m|[\s\S]/gu)) {
		if (token.startsWith('\x1b[')) {
			style = /^\x1b\[0?m$/.test(token) ? '' : token.startsWith('\x1b[0;') ? token : style + token;
		} else if (count === width) {
			rows.push(`${row}${reset}`);
			row = style;
			count = 0;
		}
		row += token;
		if (!token.startsWith('\x1b')) count += 1;
	}
	rows.push(`${row}${reset}`);
	return rows;
}

// Lays the buttons out on one row and paints the highlight over the columns
// in `span`, which can sit between buttons while it slides.
function renderButtons(buttons, [from, to], underlineKeys) {
	const cells = [];
	const spans = [];
	for (const [index, { label, key }] of buttons.entries()) {
		if (index > 0) cells.push({ character: ' ' }, { character: ' ' });
		const at = underlineKeys ? label.toLowerCase().indexOf(key) : -1;
		spans.push([cells.length, cells.length + label.length + 2]);
		for (const [position, character] of [...' ', ...label, ...' '].entries()) {
			cells.push({ character, button: true, underline: at !== -1 && position === at + 1 });
		}
	}
	let row = '';
	let previous;
	for (const [column, { character, button, underline }] of cells.entries()) {
		const background =
			column >= Math.round(from) && column < Math.round(to)
				? focusedButton
				: button
					? idleButton
					: '';
		const style = `${background}${underline ? '\x1b[4m' : ''}`;
		if (style !== previous) row += `${reset}${style}`;
		previous = style;
		row += character;
	}
	return { row: `${row}${reset}`, spans };
}

// A full-screen view of the dev server: status, links, and a button bar at
// the top, and the logs below with their own scrollback. The mouse isn't
// captured, so links and text selection keep working; terminals turn the
// wheel into arrow keys on this alternate screen.
export function createScreen({ projectRoot, allFrontends, onAction, onDetach }) {
	const output = process.stdout;
	const input = process.stdin;
	let state;
	// "bar", { confirm }, or { servers } while the worktrees picker is open.
	let mode = 'bar';
	let focus = 0;
	let barFocus = 0;
	let span = [0, 0];
	let animation;
	// Holds as much as the service keeps, so attaching shows all of it.
	const logLines = [];
	let logLength = 0;
	let partialLine = '';
	// Rows scrolled up from the newest output; 0 follows new output.
	let scrollOffset = 0;
	let logHeight = 0;
	let drawnRows = [];
	let pendingDraw;
	// The sign-in link under the frontends: { link }, { error }, or { pending }
	// while Convex makes it.
	let signIn;
	let signInExpiry;

	const confirmation = (question, label, action) => ({ confirm: { question, label, action } });
	const barButtons = () => [
		{
			label: 'Restart',
			key: 'r',
			mode: () => confirmation('Restart the dev server?', 'Restart', { action: 'restart' })
		},
		{
			label: 'Stop',
			key: 's',
			mode: () =>
				confirmation('Stop the dev server for everyone watching it?', 'Stop', { action: 'stop' })
		},
		{ label: 'Worktrees', key: 'w', mode: openServers },
		...(signInConfig ? [{ label: 'Sign in', key: 'i', run: showSignInLink }] : []),
		...Object.entries(allFrontends)
			.filter(([key]) => !state.frontends.some((frontend) => frontend.key === key))
			.map(([key, { name }]) => ({
				label: `Add ${name}`,
				key: name[0].toLowerCase(),
				mode: () =>
					confirmation(`Start ${name} on this dev server?`, `Add ${name}`, {
						action: 'add',
						frontend: key
					})
			}))
	];
	const buttons = () => {
		if (mode === 'bar') return barButtons();
		if (mode.confirm) return [{ label: 'Cancel' }, { label: mode.confirm.label }];
		const selected = mode.servers.list?.filter(({ root }) => mode.servers.selected.has(root)) ?? [];
		return [
			{ label: 'Cancel' },
			{ label: `Stop selected (${selected.length})`, roots: selected.map(({ root }) => root) },
			{
				label: `Stop all (${mode.servers.list?.length ?? 0})`,
				roots: mode.servers.list?.map(({ root }) => root) ?? []
			}
		];
	};

	function openServers() {
		const servers = { list: undefined, selected: new Set(), row: 0 };
		listServers(projectRoot).then((list) => {
			servers.list = list;
			draw();
		});
		return { servers };
	}

	function showSignInLink() {
		if (signIn?.pending) return;
		signIn = { pending: true };
		draw();
		clearTimeout(signInExpiry);
		createSignInLink(projectRoot, state)
			.then(
				(link) => {
					signIn = { link };
					signInExpiry = setTimeout(() => {
						signIn = undefined;
						draw();
					}, 5 * 60_000);
				},
				// Convex's output ends in details or a stack, so the error's own line says more.
				(error) => {
					const lines = (error.stderr || error.message).trim().split('\n');
					signIn = { error: lines.findLast((line) => /Error\b/.test(line)) ?? lines.at(-1) };
				}
			)
			.then(draw);
	}

	function setMode(next) {
		if (mode === 'bar') barFocus = focus;
		mode = next;
		// Cancel comes first, so an accidental Enter does nothing.
		focus = mode === 'bar' ? Math.min(barFocus, buttons().length - 1) : 0;
		span = renderButtons(buttons(), [0, 0]).spans[focus];
		draw();
	}

	function panel() {
		const dot = state.restarting ? styleText('yellow', '●') : styleText('green', '●');
		const status = state.restarting
			? 'restarting'
			: `running ${formatDuration(Date.now() - state.startedAt)}`;
		// The count includes this terminal.
		const others = state.watchers - 1;
		const watching =
			others === 0
				? 'only this terminal'
				: `${others} other terminal${others === 1 ? '' : 's'} watching`;
		const rows = [
			`${dot} ${styleText('bold', state.branch)}  ${styleText('dim', `${status} · ${watching}`)}`
		];
		const { row: buttonRow } = renderButtons(buttons(), span, mode === 'bar');

		if (mode.servers) {
			const { list, selected, row } = mode.servers;
			rows.push(styleText('dim', '  Dev servers on this machine'));
			if (!list) rows.push(styleText('dim', '  Loading…'));
			else if (list.length === 0) rows.push(styleText('dim', '  None are running.'));
			for (const [index, server] of (list ?? []).entries()) {
				const { label, hint } = describeServer(server, projectRoot);
				const pointer = index === row ? styleText('cyan', '›') : ' ';
				const box = selected.has(server.root) ? styleText('green', '◼') : '◻';
				rows.push(`${pointer} ${box} ${label}  ${styleText('dim', hint)}`);
			}
			rows.push(`  ${buttonRow}  ${styleText('dim', '↑/↓ · space select · ←/→ · enter · esc')}`);
		} else {
			const nameWidth = Math.max(...state.frontends.map(({ name }) => name.length));
			for (const { name, urls } of state.frontends) {
				rows.push(
					urls
						? [
								`  ${name.padEnd(nameWidth)} `,
								urls.https && styleText('cyan', link(urls.https)),
								urls.tailscale && styleText('dim', link(urls.tailscale)),
								styleText('dim', link(urls.local))
							]
								.filter(Boolean)
								.join('  ')
						: `  ${name.padEnd(nameWidth)}  ${styleText('dim', 'starting…')}`
				);
			}
			if (signIn) {
				rows.push(
					`  ${styleText('dim', 'Sign in')}  ${
						signIn.link
							? `${styleText('cyan', link(signIn.link))}  ${styleText('dim', 'valid for 5 minutes')}`
							: signIn.error
								? styleText('red', signIn.error)
								: styleText('dim', 'creating a link…')
					}`
				);
			}
			rows.push(
				mode.confirm
					? `  ${mode.confirm.question}  ${buttonRow}  ${styleText('dim', '←/→ · enter · esc')}`
					: `  ${buttonRow}  ${styleText('dim', '←/→ · enter · scroll · ^C detach')}`
			);
		}
		const scrolled = scrollOffset > 0 ? ` ↑ ${scrollOffset} rows up · End to follow ` : '';
		rows.push(
			`${styleText('dim', '──')}${styleText('yellow', scrolled)}${styleText('dim', '─'.repeat(Math.max(0, output.columns - 2 - scrolled.length)))}`
		);
		return rows;
	}

	// The rows of the log view, newest at the bottom, `scrollOffset` rows up.
	function logRows() {
		const width = output.columns;
		const lines = partialLine ? [...logLines, { text: cleanLogLine(partialLine) }] : logLines;
		const rows = [];
		let index = lines.length - 1;
		for (; index >= 0 && rows.length < logHeight + scrollOffset; index--) {
			const line = lines[index];
			if (line.width !== width) {
				line.rows = wrapLogLine(line.text, width);
				line.width = width;
			}
			rows.unshift(...line.rows);
		}
		// Scrolled past the oldest line.
		if (index < 0) scrollOffset = Math.max(0, Math.min(scrollOffset, rows.length - logHeight));
		return rows.slice(
			Math.max(0, rows.length - scrollOffset - logHeight),
			rows.length - scrollOffset
		);
	}

	// Draws a frame, rewriting only the rows that changed. Synchronized output
	// keeps terminals that support it from showing a half-drawn frame.
	function draw() {
		pendingDraw = undefined;
		if (!state) return;
		const requestedOffset = scrollOffset;
		let top = panel();
		logHeight = output.rows - top.length;
		const logs = logRows();
		// logRows clamps the offset at the oldest line, which the divider shows.
		if (scrollOffset !== requestedOffset) top = panel();
		// Cut to the terminal's height for when the panel alone is taller.
		const rows = [...top, ...logs, ...Array(Math.max(0, logHeight - logs.length)).fill('')].slice(
			0,
			output.rows
		);
		let frame = '';
		rows.forEach((row, index) => {
			if (drawnRows[index] !== row) frame += `\x1b[${index + 1};1H\x1b[2K${row}`;
		});
		drawnRows = rows;
		if (frame) output.write(`\x1b[?2026h${frame}\x1b[?2026l`);
	}

	// Output can arrive in bursts, so drawing waits for the next frame.
	const scheduleDraw = () => (pendingDraw ??= setTimeout(draw, 16));

	function scrollBy(rows) {
		scrollOffset = Math.max(0, scrollOffset + rows);
		draw();
	}

	// Eases the highlight toward the focused button, retargeting mid-slide.
	function slideTo(index) {
		focus = index;
		clearInterval(animation);
		animation = setInterval(() => {
			const target = renderButtons(buttons(), span).spans[focus];
			span = span.map((value, end) => value + (target[end] - value) * 0.45);
			if (span.every((value, end) => Math.abs(target[end] - value) < 0.5)) {
				span = target;
				clearInterval(animation);
			}
			draw();
		}, 16);
	}

	function activate() {
		const button = buttons()[focus];
		if (button.run) return button.run();
		if (mode === 'bar') return setMode(button.mode());
		if (mode.confirm) {
			if (focus === 1) onAction(mode.confirm.action);
			return setMode('bar');
		}
		if (focus === 0) return setMode('bar');
		if (button.roots.length === 0) return;
		stopServers(button.roots);
		setMode('bar');
	}

	function onKey(key) {
		if (key === 'ctrl-c') return onDetach();
		// Keys typed while the service starts arrive before its first state.
		if (!state) return;
		const count = buttons().length;
		if (key === 'right') return slideTo((focus + 1) % count);
		if (key === 'left') return slideTo((focus + count - 1) % count);
		if (key === 'enter') return activate();
		if (key === 'escape' && mode !== 'bar') return setMode('bar');
		if (key === 'page-up') return scrollBy(logHeight - 1);
		if (key === 'page-down') return scrollBy(-(logHeight - 1));
		if (key === 'home') return scrollBy(Infinity);
		if (key === 'end') return scrollBy(-Infinity);
		if (mode.servers?.list?.length) {
			const servers = mode.servers;
			if (key === 'up') servers.row = (servers.row + servers.list.length - 1) % servers.list.length;
			if (key === 'down') servers.row = (servers.row + 1) % servers.list.length;
			if (key === 'space') {
				const { root } = servers.list[servers.row];
				if (!servers.selected.delete(root)) servers.selected.add(root);
			}
			return draw();
		}
		if (key === 'up') return scrollBy(1);
		if (key === 'down') return scrollBy(-1);
		if (mode === 'bar') {
			const index = buttons().findIndex(({ key: shortcut }) => shortcut === key);
			if (index !== -1) {
				focus = index;
				activate();
			}
		}
	}

	function onData(data) {
		for (const [sequence] of data.matchAll(/\x1b\[[0-9;]*[A-Za-z~]|\x1bO[A-Za-z]|\x1b|[\s\S]/g)) {
			onKey(keyNames[sequence] ?? sequence);
		}
	}

	// Alternate screen, hidden cursor, no autowrap; undone on any exit so a
	// crash can't leave the terminal in this state.
	const leave = () => output.write('\x1b[?7h\x1b[?25h\x1b[?1049l');
	output.write('\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J');
	process.once('exit', leave);
	input.setRawMode(true);
	input.setEncoding('utf8');
	input.on('data', onData);
	// A clack prompt before this pauses stdin, and adding a listener doesn't
	// resume an explicitly paused stream.
	input.resume();
	output.on('resize', () => {
		drawnRows = [];
		output.write('\x1b[2J');
		draw();
	});
	const tick = setInterval(draw, 30_000);

	return {
		write(data) {
			// An unfinished line is already on screen as the last row, so it counts
			// before and after when keeping the view still while scrolled up.
			const partialRows = () =>
				partialLine ? wrapLogLine(cleanLogLine(partialLine), output.columns).length : 0;
			let addedRows = -partialRows();
			const lines = `${partialLine}${data}`.split('\n');
			partialLine = lines.pop();
			for (const text of lines) {
				const line = { text: cleanLogLine(text) };
				logLines.push(line);
				logLength += line.text.length;
				if (scrollOffset > 0) addedRows += wrapLogLine(line.text, output.columns).length;
			}
			if (scrollOffset > 0) scrollOffset += addedRows + partialRows();
			while (logLength > historyLimit) logLength -= logLines.shift().text.length;
			scheduleDraw();
		},
		setState(next) {
			state = next;
			// Buttons can come and go (Add <frontend>), so the highlight snaps to
			// the focused one's new place.
			if (mode === 'bar') focus = Math.min(focus, buttons().length - 1);
			clearInterval(animation);
			span = renderButtons(buttons(), [0, 0]).spans[focus];
			draw();
		},
		// The newest log lines, for showing after the screen closes.
		tail(count) {
			return [...logLines.map(({ text }) => text), cleanLogLine(partialLine)]
				.filter(Boolean)
				.slice(-count);
		},
		close() {
			clearInterval(tick);
			clearInterval(animation);
			clearTimeout(signInExpiry);
			clearTimeout(pendingDraw);
			input.off('data', onData);
			input.setRawMode(false);
			input.pause();
			process.off('exit', leave);
			leave();
		}
	};
}
