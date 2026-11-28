<script module lang="ts">
	import type { Drive, Play, PlayPath, Team } from '#lib/types.js';

	export type Charted = Play & { path: PlayPath };

	/** The plays a drive's chart draws, in order: the ones that moved the ball, or tried to. */
	export function charted(drive: Drive): Charted[] {
		return drive.plays.filter((p): p is Charted => p.path !== null);
	}

	/** Each kind of play in the colour of its kind of stat, so a catch here is a catch in the box score. */
	export function colorOf(path: PlayPath) {
		switch (path.kind) {
			case 'run':
				return 'var(--kind-rushing)';
			case 'pass':
				return 'var(--kind-passing)';
			case 'sack':
			case 'interception':
				return 'var(--flag)';
			case 'penalty':
				return 'var(--penalty)';
			case 'fumble':
				return path.failed ? 'var(--flag)' : 'var(--kind-fumbles)';
			case 'punt':
			case 'kickoff':
			case 'fieldGoal':
				return 'var(--kind-kicking)';
			default:
				return 'var(--muted-foreground)';
		}
	}
</script>

<script lang="ts">
	let {
		drive,
		defense,
		active = $bindable(null)
	}: {
		drive: Drive & { team: Team };
		defense: Team;
		/** The play being pointed at, here or in the list under the chart. */
		active?: string | null;
	} = $props();

	const uid = $props.id();

	/*
	 * The field from up in the stands, the drive's own end zone on the left. The camera's perspective is simple:
	 * a point `z` yards from the near sideline shrinks by k = 1 / (1 + 0.0066z) toward a vanishing point above the
	 * field. Each play gets its own line across the field, the first at the far side and the last nearest, so the
	 * drive climbs down toward the camera as it goes, and the plays nearest the end zone are drawn biggest.
	 */
	const W = 720;
	const NEAR = 318;
	const VANISH = -261;
	const YARD = 5.6;
	const WIDTH = 53.3;

	/** A spot on screen: `x` in yards from the back of the drive's own end zone (0 to 120), `z` across, `h` up. */
	function at(x: number, z: number, h = 0) {
		const k = 1 / (1 + z * 0.0066);
		return {
			x: W / 2 + (x - 60) * YARD * k,
			y: VANISH + (NEAR - VANISH) * k - h * YARD * k * 1.1,
			k
		};
	}
	const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
	const line = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${pt(a)} L${pt(b)}`;
	/** A strip of field from one yard line to another, sideline to sideline (or past them). */
	const strip = (x0: number, x1: number, z0 = 0, z1 = WIDTH) =>
		`M${pt(at(x0, z0))} L${pt(at(x1, z0))} L${pt(at(x1, z1))} L${pt(at(x0, z1))} Z`;
	/** A ball in flight from one spot to another along a lane, as a parabola, and its shadow on the grass. */
	function flight(x0: number, x1: number, z: number, peak: number) {
		const air: string[] = [];
		const ground: string[] = [];
		for (let i = 0; i <= 32; i++) {
			const t = i / 32;
			const x = x0 + (x1 - x0) * t;
			air.push(pt(at(x, z, 4 * peak * t * (1 - t))));
			ground.push(pt(at(x, z)));
		}
		return {
			air: `M${air.join(' L')}`,
			ground: `M${ground.join(' L')}`,
			top: at((x0 + x1) / 2, z, peak).y
		};
	}

	type Shape =
		| {
				type: 'path';
				d: string;
				color: string;
				width: number;
				dash?: string;
				opacity?: number;
				arrow?: string;
				/** How high on screen a ball in flight goes, to make room for it. */
				top?: number;
		  }
		| { type: 'dot'; x: number; y: number; r: number; color: string }
		| { type: 'miss'; x: number; y: number; r: number; color: string }
		| { type: 'flag'; x: number; y: number; k: number }
		| { type: 'posts'; x: number; y: number; k: number }
		| { type: 'glow'; x: number; y: number; r: number };

	/** The arrowheads, one per colour: a marker can't take the colour of the line it ends. */
	const ARROWS = {
		run: 'var(--kind-rushing)',
		pass: 'var(--kind-passing)',
		flag: 'var(--flag)',
		penalty: 'var(--penalty)',
		fumble: 'var(--kind-fumbles)',
		kick: 'var(--kind-kicking)',
		muted: 'var(--muted-foreground)'
	};
	const arrowFor = (color: string) =>
		`url(#${uid}-${Object.entries(ARROWS).find(([, c]) => c === color)?.[0] ?? 'muted'})`;

	/** How high a pass goes for how far it went: a short one stays low, a catch at the line barely leaves it. */
	const lob = (yards: number) => Math.min(2 + Math.abs(yards) * 0.42, 0.5 + Math.abs(yards) * 0.6);

	const plays = $derived(charted(drive));
	// Another open drive's play being pointed at leaves this one alone.
	const mine = $derived(plays.some((play) => play.id === active));
	const lane = (i: number) => (plays.length < 2 ? 27 : 45 - (i * 36) / (plays.length - 1));

	function shapes(play: Charted, z: number): Shape[] {
		const { kind, failed } = play.path;
		const x0 = play.path.from + 10;
		const x1 = play.path.to + 10;
		const landed = play.path.landed == null ? null : play.path.landed + 10;
		const color = colorOf(play.path);
		const start = at(x0, z);
		const end = at(x1, z);
		const w = 3.4 * start.k + 0.6;
		const out: Shape[] = [];
		const ball = (to: number, peak: number, dash?: string, c = color) => {
			const { air, ground, top } = flight(x0, to, z, peak);
			out.push({ type: 'path', d: ground, color: '#000', width: w * 1.1, opacity: 0.45 });
			out.push({ type: 'path', d: air, color: c, width: w * 0.8, dash, top });
			return at(to, z);
		};
		const carry = (from: { x: number; y: number }, opacity = 1, dash?: string) => {
			if (Math.abs(from.x - end.x) < 1) return;
			out.push({
				type: 'path',
				d: line(from, end),
				color,
				width: w,
				opacity,
				dash,
				arrow: arrowFor(color)
			});
		};

		switch (kind) {
			case 'pass': {
				// No catch point from ESPN: one arc from the line of scrimmage to where the play ended.
				const caught = ball(landed ?? x1, lob((landed ?? x1) - x0));
				out.push({ type: 'dot', ...caught, r: 3 * start.k + 0.8, color });
				carry(caught, 0.6);
				break;
			}
			case 'incomplete': {
				const to = landed ?? x0 + 7;
				const fell = ball(to, lob(to - x0), '5 4', 'var(--muted-foreground)');
				out.push({ type: 'miss', ...fell, r: 4.5 * start.k + 1, color: 'var(--foreground)' });
				break;
			}
			case 'interception': {
				const to = landed ?? x0 + 7;
				const picked = ball(to, lob(to - x0));
				out.push({ type: 'miss', ...picked, r: 4.5 * start.k + 1, color });
				carry(picked, 0.6, '4 3');
				break;
			}
			case 'punt':
			case 'kickoff': {
				const to = landed ?? x1;
				const down = ball(to, Math.min(16, Math.abs(to - x0) * 0.3), '1 5');
				carry(down, 0.6);
				break;
			}
			case 'fieldGoal': {
				const posts = ball(120, 12, '1 5');
				out.push({ type: 'posts', ...posts });
				if (failed) out.push({ type: 'miss', ...posts, r: 5 * posts.k + 1, color: 'var(--flag)' });
				break;
			}
			case 'penalty':
				carry(start, 1, '3 3');
				out.push({ type: 'flag', ...start });
				break;
			case 'fumble':
				carry(start);
				out.push({ type: 'dot', ...end, r: 3.6 * end.k + 0.8, color });
				break;
			default:
				if (Math.abs(start.x - end.x) < 1)
					out.push({ type: 'dot', ...end, r: 2.4 * end.k + 0.6, color });
				else carry(start);
		}
		if (play.scoring && kind !== 'fieldGoal') out.push({ type: 'glow', ...end, r: 22 * end.k });
		return out;
	}

	const drawn = $derived(
		plays.map((play, i) => {
			const z = lane(i);
			const from = at(play.path.from + 10, z);
			return {
				play,
				n: i + 1,
				from,
				tick: line(at(play.path.from + 10, z - 1.6), at(play.path.from + 10, z + 1.6)),
				tag: at(play.path.from + 7.8, z),
				shapes: shapes(play, z),
				// Where the next play picks up: the ball doesn't always stay where this one left it.
				next:
					i < plays.length - 1
						? line(at(play.path.to + 10, z), at(plays[i + 1].path.from + 10, lane(i + 1)))
						: null
			};
		})
	);

	// Room above the far sideline for the highest ball in the air, and no more.
	const top = $derived(
		Math.min(
			at(0, WIDTH + 3).y - 12,
			...drawn.flatMap(({ shapes }) => shapes.map((s) => (s.type === 'path' && s.top) || Infinity))
		) - 8
	);
	const BOTTOM = at(0, -3).y + 2;

	const yardLines = Array.from({ length: 21 }, (_, i) => 10 + i * 5);
	const numbers = Array.from({ length: 9 }, (_, i) => 20 + i * 10).flatMap((x) =>
		[3.5, 50].map((z) => ({ x, z, n: x - 10 > 50 ? 110 - x : x - 10, p: at(x, z) }))
	);
	const ends = $derived([
		{ team: drive.team, x0: 0, x1: 10, opacity: 0.2 },
		{ team: defense, x0: 110, x1: 120, opacity: 0.38 }
	]);
	const label = (x: number) => ({ ...at(x, WIDTH / 2) });
</script>

<!-- The drive across the whole field, one line per play. The list under it says the same in words. -->
<svg
	viewBox="0 {top} {W} {BOTTOM - top}"
	class="block h-auto w-full select-none"
	role="img"
	aria-label="{drive.team.name}: {drive.result ?? 'drive'}, {drive.summary}"
>
	<defs>
		{#each Object.entries(ARROWS) as [key, color] (key)}
			<marker
				id="{uid}-{key}"
				viewBox="0 0 10 10"
				refX="7"
				refY="5"
				markerWidth="2.6"
				markerHeight="2.6"
				orient="auto-start-reverse"
			>
				<path d="M0,0 L10,5 L0,10 z" style:fill={color} />
			</marker>
		{/each}
		<radialGradient id="{uid}-glow">
			<stop offset="0" stop-color="var(--pylon)" stop-opacity="0.55" />
			<stop offset="1" stop-color="var(--pylon)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- Grass, mown in five-yard stripes, with each team's end zone in its colour. -->
	<path d={strip(-3, 123, -3, WIDTH + 3)} fill="#0b0f0d" />
	<path d={strip(0, 120)} fill="#121a16" />
	{#each yardLines.filter((x) => x % 10 === 0 && x < 110) as x (x)}
		<path d={strip(x, x + 5)} fill="#142019" />
	{/each}
	{#each ends as end (end.x0)}
		{@const p = label((end.x0 + end.x1) / 2)}
		<path d={strip(end.x0, end.x1)} style:fill={end.team.color} opacity={end.opacity} />
		<text
			x={p.x}
			y={p.y + 6 * p.k}
			font-size={18 * p.k}
			text-anchor="middle"
			class="fill-foreground/30 font-display font-bold tracking-widest"
			>{end.team.abbreviation}</text
		>
	{/each}
	{#each yardLines as x (x)}
		{@const a = at(x, 0)}
		{@const b = at(x, WIDTH)}
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			class="stroke-foreground"
			stroke-opacity={x === 10 || x === 110 ? 0.4 : x % 10 === 0 ? 0.14 : 0.06}
		/>
	{/each}
	{#each numbers as { x, z, n, p } (`${x}-${z}`)}
		<text
			x={p.x}
			y={p.y + 5 * p.k}
			font-size={17 * p.k}
			text-anchor="middle"
			class="fill-foreground/20 font-display font-semibold">{n}</text
		>
	{/each}

	{#each drawn as { next }, i (i)}
		{#if next}
			<path d={next} class="stroke-foreground/20" stroke-dasharray="2 3" fill="none" />
		{/if}
	{/each}

	{#each drawn as { play, n, from, tick, tag, shapes: list } (play.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<g
			class="transition-opacity duration-150"
			opacity={mine && active !== play.id ? 0.18 : 1}
			onpointerenter={() => (active = play.id)}
			onpointerleave={() => (active = null)}
		>
			<path d={tick} class="stroke-foreground/50" stroke-width="1.4" />
			<circle cx={from.x} cy={from.y} r={2.4 * from.k + 0.6} class="fill-foreground" />
			{#each list as s, j (j)}
				{#if s.type === 'path'}
					<path
						d={s.d}
						fill="none"
						style:stroke={s.color}
						stroke-width={s.width}
						stroke-opacity={s.opacity ?? 1}
						stroke-dasharray={s.dash}
						stroke-linecap="round"
						marker-end={s.arrow}
					/>
				{:else if s.type === 'dot'}
					<circle cx={s.x} cy={s.y} r={s.r} style:fill={s.color} />
				{:else if s.type === 'miss'}
					<path
						d="M{s.x - s.r},{s.y - s.r} L{s.x + s.r},{s.y + s.r} M{s.x + s.r},{s.y - s.r} L{s.x -
							s.r},{s.y + s.r}"
						style:stroke={s.color}
						stroke-width="2.2"
						stroke-linecap="round"
					/>
				{:else if s.type === 'flag'}
					<path
						d="M{s.x},{s.y} l0,{-14 * s.k} l{9 * s.k},{3 * s.k} l{-9 * s.k},{4 * s.k}"
						style:fill="var(--penalty)"
						style:stroke="var(--penalty)"
						stroke-width="1.4"
						stroke-linejoin="round"
					/>
				{:else if s.type === 'posts'}
					<path
						d="M{s.x - 7 * s.k},{s.y - 22 * s.k} L{s.x - 7 * s.k},{s.y - 8 * s.k} L{s.x +
							7 * s.k},{s.y - 8 * s.k} L{s.x + 7 * s.k},{s.y - 22 * s.k} M{s.x},{s.y -
							8 * s.k} L{s.x},{s.y}"
						class="stroke-foreground"
						stroke-width="1.6"
						fill="none"
					/>
				{:else if s.type === 'glow'}
					<circle cx={s.x} cy={s.y} r={s.r} fill="url(#{uid}-glow)" />
				{/if}
			{/each}
			<text
				x={tag.x}
				y={tag.y + 3.5 * tag.k}
				font-size={10 * tag.k + 2}
				text-anchor="end"
				class="fill-foreground/60 font-mono">{n}</text
			>
		</g>
	{/each}
</svg>
