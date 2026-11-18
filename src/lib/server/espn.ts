// ESPN's public site API. Unofficial and undocumented, but keyless and stable for years.
// Everything ESPN-shaped stays in this file: the rest of the app sees the types in #lib/types.js.
import { error, isHttpError } from '@sveltejs/kit';
import type {
	BoxScoreTable,
	Conference,
	DepthUnit,
	Drive,
	Game,
	GameDetail,
	GameLog,
	GameSide,
	GameState,
	Leaders,
	Player,
	PlayerDetail,
	Roster,
	Scoreboard,
	SearchResults,
	StandingRow,
	StatLine,
	StatTable,
	Team,
	TeamDetail,
	TeamStats
} from '#lib/types.js';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings';
// site.web.api.espn.com serves the same athlete API but refuses every request from Cloudflare's IPs.
const COMMON = 'https://site.api.espn.com/apis/common/v3';
const ATHLETES = `${COMMON}/sports/football/nfl/athletes`;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ESPN's JSON is deep and loosely typed; we only read it here, and map it into our own types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/*
 * ESPN's edge turns away some requests from Cloudflare's datacenter IPs with a 403, more often when they
 * don't look like they came from a browser. So look like one, and give a refused request a second try.
 */
const HEADERS = {
	accept: 'application/json',
	'user-agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
	referer: 'https://www.espn.com/'
};
const RETRY_AFTER = 500;

async function request(url: string): Promise<Json> {
	let status = 0;
	for (const attempt of [1, 2]) {
		if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER));
		// A network failure gets the same second try as a refusal.
		const response = await fetch(url, { headers: HEADERS }).catch(() => null);
		if (response?.ok) return response.json();
		await response?.body?.cancel();
		if (response?.status === 404) error(404, 'Not found');
		// A sort or filter ESPN doesn't have. Asking again won't change its mind.
		if (response?.status === 400) error(400, 'ESPN turned the request down');
		status = response?.status ?? 0;
		if (response && status !== 403 && status !== 429 && status < 500) break;
	}
	error(502, status ? `ESPN answered ${status}` : "Couldn't reach ESPN");
}

/*
 * Responses are cached in memory per server instance, so a busy page costs ESPN one request per TTL rather
 * than one per visitor. In-flight requests are shared too, and a failed request isn't cached.
 *
 * The last good response for each URL is kept for a day, and served when ESPN fails: a slightly old page
 * beats an error page. It's capped, oldest first, since a Worker only gets 128 MB. A fallback
 * is only cached briefly, so ESPN gets asked again soon rather than after the URL's full TTL.
 *
 * `trim` cuts a response down to what the app reads before it's kept: fifty league leaders come as 750 KB
 * of JSON, nearly all of it logos and links. `keep: false` is for URLs nobody asks for twice in a day
 * (a search), which would only push better fallbacks out.
 */
const cache = new Map<string, { expires: number; value: Promise<Json> }>();
const lastGood = new Map<string, { until: number; data: Json }>();
const CACHE_MAX = 500;
const LAST_GOOD_MAX = 200;
const FALLBACK_TTL = 30 * SECOND;

function get(
	url: string,
	ttl: number,
	{ trim, keep = true }: { trim?: (data: Json) => Json; keep?: boolean } = {}
): Promise<Json> {
	const now = Date.now();
	const hit = cache.get(url);
	if (hit && hit.expires > now) return hit.value;
	// Every player, week and search is its own URL, so drop stale entries now and then rather than keep them
	// all, and the oldest of the rest if that isn't enough.
	if (cache.size > CACHE_MAX) {
		for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key);
		for (const key of cache.keys()) {
			if (cache.size <= CACHE_MAX) break;
			cache.delete(key);
		}
	}

	const value = request(url).then(
		(response) => {
			const data = trim ? trim(response) : response;
			if (!keep) return data;
			lastGood.delete(url);
			lastGood.set(url, { until: Date.now() + DAY, data });
			if (lastGood.size > LAST_GOOD_MAX) lastGood.delete(lastGood.keys().next().value!);
			return data;
		},
		(failure) => {
			const fallback = lastGood.get(url);
			if (!fallback || fallback.until <= Date.now() || isHttpError(failure, 404)) throw failure;
			// `cached` is set below, before ESPN can possibly have answered.
			cached.expires = Math.min(cached.expires, Date.now() + FALLBACK_TTL);
			return fallback.data;
		}
	);
	const cached = { expires: now + ttl, value };
	cache.set(url, cached);
	value.catch(() => cache.delete(url));
	return value;
}

const num = (value: unknown) => (value == null || value === '' ? null : Number(value));

/** ESPN colours come as bare hex, sometimes missing or near-black, which disappears on a dark page. */
function teamColor(color?: string, alternate?: string) {
	const usable = (hex?: string) => {
		if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return false;
		const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b > 40;
	};
	if (usable(color)) return `#${color}`;
	if (usable(alternate)) return `#${alternate}`;
	return '#8e978f';
}

/** ESPN serves a version of every logo drawn for dark backgrounds; the plain ones lose dark marks (Giants, Jets). */
const darkLogo = (href: string) => href.replace('/teamlogos/nfl/500/', '/teamlogos/nfl/500-dark/');

function mapTeam(t: Json): Team {
	return {
		id: String(t.id),
		abbreviation: t.abbreviation,
		name: t.displayName,
		location: t.location,
		nickname: t.name ?? t.nickname,
		color: teamColor(t.color, t.alternateColor),
		logo: darkLogo(t.logos?.[0]?.href ?? t.logo ?? '')
	};
}

/* Teams */

export async function teams(): Promise<Team[]> {
	const data = await get(`${SITE}/teams`, 6 * HOUR);
	return data.sports[0].leagues[0].teams
		.map((entry: Json) => mapTeam(entry.team))
		.sort((a: Team, b: Team) => a.name.localeCompare(b.name));
}

export async function team(id: string): Promise<TeamDetail> {
	const data = await get(`${SITE}/teams/${id}`, 5 * MINUTE);
	const t = data.team;
	const records = t.record?.items ?? [];
	const total = records.find((r: Json) => r.type === 'total');
	const stat = (name: string) => total?.stats.find((s: Json) => s.name === name)?.value ?? null;
	return {
		...mapTeam(t),
		record: total?.summary ?? '0-0',
		home: records.find((r: Json) => r.type === 'home')?.summary ?? null,
		road: records.find((r: Json) => r.type === 'road')?.summary ?? null,
		standing: t.standingSummary ?? null,
		pointsFor: stat('pointsFor'),
		pointsAgainst: stat('pointsAgainst'),
		streak: stat('streak'),
		venue: t.franchise?.venue?.fullName ?? null
	};
}

/* Games */

function mapSide(c: Json): GameSide {
	const score = typeof c.score === 'object' ? c.score?.displayValue : c.score;
	const records = c.records ?? c.record ?? [];
	return {
		team: mapTeam(c.team),
		homeAway: c.homeAway,
		score: num(score),
		winner: c.winner ?? null,
		record:
			records.find((r: Json) => r.type === 'total')?.summary ?? records[0]?.displayValue ?? null,
		linescores: (c.linescores ?? []).map((l: Json) => num(l.value ?? l.displayValue) ?? 0)
	};
}

function mapGame(e: Json): Game {
	const comp = e.competitions[0];
	const sides = comp.competitors.map(mapSide);
	const status = comp.status?.type ?? e.status?.type;
	const situation = comp.situation;
	const state: GameState = status?.state ?? (status?.completed ? 'post' : 'pre');
	return {
		id: String(e.id),
		date: e.date,
		name: e.name,
		week: e.week?.number ?? null,
		state,
		detail: status?.shortDetail ?? '',
		venue: comp.venue?.fullName ?? null,
		broadcast:
			comp.broadcast ??
			comp.broadcasts
				?.map((b: Json) => b.media?.shortName ?? b.names?.join('/'))
				.filter(Boolean)
				.join('/') ??
			null,
		odds: comp.odds?.[0]?.details ?? null,
		situation:
			state === 'in' && situation
				? {
						downDistance: situation.downDistanceText ?? null,
						possession: situation.possession ? String(situation.possession) : null,
						redZone: Boolean(situation.isRedZone),
						lastPlay: situation.lastPlay?.text ?? null
					}
				: null,
		home: sides.find((s: GameSide) => s.homeAway === 'home'),
		away: sides.find((s: GameSide) => s.homeAway === 'away')
	};
}

export async function scoreboard(week?: number, seasonType?: number): Promise<Scoreboard> {
	const params = new URLSearchParams();
	if (week) params.set('week', String(week));
	if (seasonType) params.set('seasontype', String(seasonType));
	const data = await get(`${SITE}/scoreboard?${params}`, 20 * SECOND);
	const calendar = data.leagues?.[0]?.calendar ?? [];
	return {
		season: data.season?.year,
		seasonType: data.season?.type,
		week: data.week?.number,
		weeks: calendar
			.filter((section: Json) => ['2', '3'].includes(String(section.value)))
			.flatMap((section: Json) =>
				section.entries.map((entry: Json) => ({
					seasonType: Number(section.value),
					week: Number(entry.value),
					label: entry.label,
					start: entry.startDate
				}))
			),
		byes: (data.week?.teamsOnBye ?? []).map(mapTeam),
		games: data.events.map(mapGame)
	};
}

export async function schedule(id: string): Promise<Game[]> {
	const data = await get(`${SITE}/teams/${id}/schedule`, 5 * MINUTE);
	return data.events.map(mapGame);
}

/* A game's box score */

/** ESPN's labels for the team box score come in three different cases; these read as one table. */
const TEAM_STAT_LABELS: Record<string, string> = {
	firstDowns: 'First downs',
	firstDownsPassing: 'Passing',
	firstDownsRushing: 'Rushing',
	firstDownsPenalty: 'Penalty',
	thirdDownEff: '3rd down',
	fourthDownEff: '4th down',
	totalOffensivePlays: 'Plays',
	totalYards: 'Total yards',
	yardsPerPlay: 'Yards / play',
	totalDrives: 'Drives',
	netPassingYards: 'Passing yards',
	completionAttempts: 'Comp / att',
	yardsPerPass: 'Yards / pass',
	interceptions: 'Interceptions',
	sacksYardsLost: 'Sacks – yards lost',
	rushingYards: 'Rushing yards',
	rushingAttempts: 'Attempts',
	yardsPerRushAttempt: 'Yards / rush',
	redZoneAttempts: 'Red zone (TD – trips)',
	totalPenaltiesYards: 'Penalties – yards',
	turnovers: 'Turnovers',
	fumblesLost: 'Fumbles lost',
	defensiveTouchdowns: 'Defensive / ST TDs',
	possessionTime: 'Possession',
	// Before kickoff ESPN sends season averages instead.
	totalPointsPerGame: 'Points',
	yardsPerGame: 'Total yards',
	passingYardsPerGame: 'Passing yards',
	rushingYardsPerGame: 'Rushing yards',
	totalPointsPerGameAllowed: 'Points allowed',
	yardsPerGameAllowed: 'Yards allowed',
	passingYardsPerGameAllowed: 'Passing yards allowed',
	rushingYardsPerGameAllowed: 'Rushing yards allowed'
};

/** Stats that break down the one above them, as ESPN lays out its own box score. */
const TEAM_SUB_STATS = new Set([
	'firstDownsPassing',
	'firstDownsRushing',
	'firstDownsPenalty',
	'completionAttempts',
	'yardsPerPass',
	'interceptions',
	'sacksYardsLost',
	'rushingAttempts',
	'yardsPerRushAttempt',
	'fumblesLost'
]);

const BOX_SCORE_NAMES: Record<string, string> = {
	passing: 'Passing',
	rushing: 'Rushing',
	receiving: 'Receiving',
	fumbles: 'Fumbles',
	defensive: 'Defense',
	interceptions: 'Interceptions',
	kickReturns: 'Kick returns',
	puntReturns: 'Punt returns',
	kicking: 'Kicking',
	punting: 'Punting'
};

function mapBoxScoreTable(c: Json): BoxScoreTable {
	return {
		name: BOX_SCORE_NAMES[c.name] ?? c.text ?? c.name,
		labels: (c.labels ?? []).map((short: string, i: number) => ({
			short,
			long: c.descriptions?.[i] ?? short
		})),
		rows: (c.athletes ?? []).map((a: Json) => ({
			player: { id: String(a.athlete.id), name: a.athlete.displayName },
			values: a.stats
		})),
		totals: c.totals?.length ? c.totals : null
	};
}

export async function game(id: string): Promise<GameDetail> {
	// Scores move every few seconds while a game is on; the page asks again every 30.
	const data = await get(`${SITE}/summary?event=${id}`, 20 * SECOND);
	const header = data.header;
	const comp = header.competitions[0];
	// The summary's header is a scoreboard event with a few things moved elsewhere in the response.
	const base = mapGame({
		...header,
		date: comp.date,
		week: { number: header.week },
		competitions: [
			{
				...comp,
				venue: data.gameInfo?.venue,
				odds: data.pickcenter,
				situation: comp.situation ?? data.situation
			}
		]
	});
	const teamsById = new Map([base.away.team, base.home.team].map((t) => [t.id, t]));

	const sides = data.boxscore?.teams ?? [];
	const side = (homeAway: string) =>
		sides.find((t: Json) => t.homeAway === homeAway) ??
		sides.find((t: Json) => String(t.team.id) === base[homeAway as 'home' | 'away'].team.id);
	const awayStats: Json[] = side('away')?.statistics ?? [];
	const homeStats: Json[] = side('home')?.statistics ?? [];

	const players: Json[] = data.boxscore?.players ?? [];
	const boxScore = [base.away.team, base.home.team].flatMap((team) => {
		const entry = players.find((p) => String(p.team.id) === team.id);
		return entry ? [{ team, tables: entry.statistics.map(mapBoxScoreTable) }] : [];
	});

	return {
		...base,
		name: `${base.away.team.name} at ${base.home.team.name}`,
		teamStats: {
			title: base.state === 'pre' ? 'Season averages' : 'Team stats',
			rows: awayStats
				// ESPN lists interceptions twice, under passing and again under turnovers.
				.filter((s, i, all) => all.findIndex((t) => t.name === s.name) === i)
				.map((s) => ({
					label: TEAM_STAT_LABELS[s.name] ?? s.label,
					away: s.displayValue,
					home: homeStats.find((t) => t.name === s.name)?.displayValue ?? '—',
					sub: TEAM_SUB_STATS.has(s.name)
				}))
		},
		boxScore,
		scoring: (data.scoringPlays ?? []).flatMap((p: Json) => {
			const team = teamsById.get(String(p.team?.id));
			if (!team) return [];
			return [
				{
					period: p.period?.number ?? 0,
					clock: p.clock?.displayValue ?? '',
					team,
					kind: p.scoringType?.abbreviation ?? p.type?.abbreviation ?? '',
					text: p.text ?? '',
					away: p.awayScore ?? 0,
					home: p.homeScore ?? 0
				}
			];
		}),
		attendance: data.gameInfo?.attendance || null
	};
}

/** Every drive of a game, first to last. It reads the summary `game` does, so it costs ESPN nothing more. */
export async function plays(id: string): Promise<Drive[]> {
	const data = await get(`${SITE}/summary?event=${id}`, 20 * SECOND);
	const teamsById = new Map<string, Team>(
		data.header.competitions[0].competitors.map((c: Json) => [String(c.team.id), mapTeam(c.team)])
	);
	// While a game is on, the drive in progress comes on its own, and sometimes among the finished ones too.
	const drives: Json[] = [...(data.drives?.previous ?? [])];
	const current = data.drives?.current;
	if (current && !drives.some((d) => d.id === current.id)) drives.push(current);

	let away = 0;
	let home = 0;
	return drives.map((d) => {
		const all: Json[] = d.plays ?? [];
		const before = { away, home };
		// The score as of the drive's last score, or its last play: on old games the kickoff after a score can
		// carry the wrong one. A drive without a play yet leaves the score where the last one did.
		const last = all.findLast((p) => p.scoringPlay) ?? all.at(-1);
		away = last?.awayScore ?? away;
		home = last?.homeScore ?? home;
		return {
			id: String(d.id),
			team: teamsById.get(String(d.team?.id)) ?? null,
			period: d.start?.period?.number ?? all[0]?.period?.number ?? 0,
			result: d.displayResult ?? null,
			// Whose score went up, which isn't always the side with the ball: a pick-six, a safety.
			scored: away > before.away ? 'away' : home > before.home ? 'home' : null,
			summary: d.description ?? '',
			away,
			home,
			plays: all.map((p) => {
				const down: string | undefined = p.start?.downDistanceText;
				return {
					id: String(p.id),
					period: p.period?.number ?? 0,
					clock: p.clock?.displayValue ?? '',
					// A timeout between downs comes as " & Goal at LAR 15", with no down to its name.
					down: down && /^\d/.test(down) ? down : null,
					text: p.text ?? '',
					scoring: Boolean(p.scoringPlay)
				};
			})
		};
	});
}

/* Standings */

/** The red and navy of the conference shields. ESPN doesn't send these. */
const CONFERENCE_COLORS: Record<string, string> = { AFC: '#d50a0a', NFC: '#013369' };

export async function standings(): Promise<Conference[]> {
	const [data, all] = await Promise.all([get(`${STANDINGS}?level=3`, 10 * MINUTE), teams()]);
	const byId = new Map(all.map((t) => [t.id, t]));
	return data.children.map((conference: Json) => ({
		name: conference.abbreviation ?? conference.name,
		logo: `https://a.espncdn.com/i/teamlogos/nfl/500/${String(conference.abbreviation).toLowerCase()}.png`,
		color: CONFERENCE_COLORS[conference.abbreviation] ?? '#8e978f',
		divisions: conference.children
			.map((division: Json) => ({
				name: division.name,
				teams: division.standings.entries
					.map((entry: Json): StandingRow => {
						const stat = (name: string) => entry.stats.find((s: Json) => s.name === name);
						const value = (name: string) => stat(name)?.value ?? 0;
						const display = (name: string) => stat(name)?.displayValue ?? '';
						return {
							team: byId.get(String(entry.team.id)) ?? mapTeam(entry.team),
							wins: value('wins'),
							losses: value('losses'),
							ties: value('ties'),
							pct: display('winPercent'),
							pointsFor: value('pointsFor'),
							pointsAgainst: value('pointsAgainst'),
							diff: value('pointDifferential'),
							streak: display('streak'),
							seed: num(stat('playoffSeed')?.value),
							home: display('Home'),
							road: display('Road'),
							division: display('vs. Div.'),
							conference: display('vs. Conf.')
						};
					})
					.sort(
						(a: StandingRow, b: StandingRow) =>
							winPct(b) - winPct(a) ||
							seedRank(a) - seedRank(b) ||
							b.diff - a.diff ||
							a.team.name.localeCompare(b.team.name)
					)
			}))
			.sort(
				(a: { name: string }, b: { name: string }) => divisionRank(a.name) - divisionRank(b.name)
			)
	}));
}

/** Divisions read North, South, East, West ("AFC North" → 0). */
const DIVISION_ORDER = ['North', 'South', 'East', 'West'];
const divisionRank = (name: string) => DIVISION_ORDER.findIndex((d) => name.endsWith(d));

// Teams level on record are split by NFL tiebreakers, which ESPN has already applied to the playoff seeds.
const seedRank = (r: StandingRow) => r.seed ?? Infinity;

const winPct = (r: StandingRow) => {
	const games = r.wins + r.losses + r.ties;
	return games ? (r.wins + r.ties / 2) / games : 0;
};

/* Roster and stats */

const ROSTER_GROUPS: Record<string, string> = {
	offense: 'Offense',
	defense: 'Defense',
	specialTeam: 'Special teams',
	injuredReserveOrOut: 'Injured reserve / out',
	suspended: 'Suspended',
	practiceSquad: 'Practice squad'
};

/** Lists outside the depth chart read offense from the quarterback out, then defense front to back, then specialists. */
const POSITION_ORDER = [
	'QB',
	'RB',
	'FB',
	'WR',
	'TE',
	'OL',
	'OT',
	'G',
	'C',
	'DL',
	'DE',
	'DT',
	'NT',
	'LB',
	'OLB',
	'ILB',
	'MLB',
	'DB',
	'CB',
	'S',
	'FS',
	'SS',
	'PK',
	'K',
	'P',
	'LS'
];
// Anything ESPN adds that isn't listed goes last.
const positionRank = (position: string | null) => {
	const rank = POSITION_ORDER.indexOf(position ?? '');
	return rank === -1 ? POSITION_ORDER.length : rank;
};

function mapPlayer(a: Json): Player {
	return {
		id: String(a.id),
		name: a.fullName ?? a.displayName,
		jersey: a.jersey ?? null,
		position: a.position?.abbreviation ?? null,
		age: a.age ?? null,
		height: a.displayHeight ?? null,
		weight: a.displayWeight ?? null,
		experience: a.experience?.years ?? null,
		college: a.college?.name ?? null,
		headshot: a.headshot?.href ?? null,
		injury: a.injuries?.[0]?.status ?? null
	};
}

const byPosition = (a: Player, b: Player) =>
	positionRank(a.position) - positionRank(b.position) ||
	Number(a.jersey ?? 999) - Number(b.jersey ?? 999);

/*
 * ESPN's depth chart has a unit per formation ("3WR 1TE", "Base 4-3 D", "Special Teams"), each a list of slots
 * with its players in depth order. Its slots come in ESPN's own order; these put them the way a lineup reads.
 * Slots not listed keep ESPN's order, after these.
 */
const SLOT_ORDER: Record<DepthUnit['name'], string[]> = {
	Offense: ['qb', 'rb', 'fb', 'wr1', 'wr2', 'wr3', 'te', 'lt', 'lg', 'c', 'rg', 'rt'],
	Defense: [],
	'Special teams': ['pk', 'p', 'ls', 'h', 'kr', 'pr']
};

function unitName(formation: string): DepthUnit['name'] {
	if (/special/i.test(formation)) return 'Special teams';
	return / D$/.test(formation) ? 'Defense' : 'Offense';
}

function mapDepthChart(data: Json, players: Map<string, Player>): DepthUnit[] {
	const units: DepthUnit[] = (data?.depthchart ?? []).map((unit: Json) => {
		const name = unitName(unit.name);
		const order = SLOT_ORDER[name];
		const rank = (key: string) => {
			const i = order.indexOf(key);
			return i === -1 ? order.length : i;
		};
		return {
			name,
			formation: unit.name,
			slots: Object.entries(unit.positions as Record<string, Json>)
				.map(([key, slot], i) => ({ key, slot, i }))
				.sort((a, b) => rank(a.key) - rank(b.key) || a.i - b.i)
				.map(({ key, slot }) => ({
					// The three receiver spots all say "WR"; their keys tell them apart.
					label: /^wr\d$/.test(key) ? key.toUpperCase() : slot.position.abbreviation,
					players: slot.athletes.map(
						(a: Json): Player =>
							players.get(String(a.id)) ?? {
								id: String(a.id),
								name: a.displayName,
								jersey: null,
								position: null,
								age: null,
								height: null,
								weight: null,
								experience: null,
								college: null,
								headshot: null,
								injury: null
							}
					)
				}))
		};
	});
	const unitOrder: DepthUnit['name'][] = ['Offense', 'Defense', 'Special teams'];
	return units.sort((a, b) => unitOrder.indexOf(a.name) - unitOrder.indexOf(b.name));
}

export async function roster(id: string): Promise<Roster> {
	const [data, depth] = await Promise.all([
		get(`${SITE}/teams/${id}/roster`, HOUR),
		// The roster still works without a depth chart, so a failure here only loses that part.
		get(`${SITE}/teams/${id}/depthcharts`, HOUR).catch(() => null)
	]);
	const coach = data.coach?.[0];
	const groups: { key: string; players: Player[] }[] = data.athletes.map((group: Json) => ({
		key: group.position,
		players: group.items.map(mapPlayer)
	}));
	const players = new Map(groups.flatMap((g) => g.players).map((p) => [p.id, p]));
	const chart = mapDepthChart(depth, players);
	const charted = new Set(chart.flatMap((u) => u.slots.flatMap((s) => s.players.map((p) => p.id))));
	const active = ['offense', 'defense', 'specialTeam'];

	return {
		coach: coach ? `${coach.firstName} ${coach.lastName}` : null,
		depth: chart,
		// With a depth chart, the active roster is already shown there; list only who it leaves out, then the
		// reserve lists. Without one, fall back to the roster's own units.
		groups: [
			...(chart.length
				? [
						{
							name: 'Not on the depth chart',
							players: groups
								.filter((g) => active.includes(g.key))
								.flatMap((g) => g.players)
								.filter((p) => !charted.has(p.id))
						}
					]
				: groups
						.filter((g) => active.includes(g.key))
						.map((g) => ({ name: ROSTER_GROUPS[g.key] ?? g.key, players: g.players }))),
			...groups
				.filter((g) => !active.includes(g.key))
				.map((g) => ({ name: ROSTER_GROUPS[g.key] ?? g.key, players: g.players }))
		]
			.map((g) => ({ ...g, players: g.players.toSorted(byPosition) }))
			.filter((g) => g.players.length)
	};
}

/** The handful of team numbers worth a glance, picked from ESPN's hundred-odd. */
const TEAM_STATS: [category: string, stat: string, label: string][] = [
	['scoring', 'totalPointsPerGame', 'Points / game'],
	['passing', 'yardsPerGame', 'Yards / game'],
	['passing', 'netPassingYardsPerGame', 'Pass yards / game'],
	['rushing', 'rushingYardsPerGame', 'Rush yards / game'],
	['passing', 'QBRating', 'Passer rating'],
	['rushing', 'yardsPerRushAttempt', 'Yards / carry'],
	['miscellaneous', 'thirdDownConvPct', '3rd down %'],
	['miscellaneous', 'redzoneTouchdownPct', 'Red zone TD %'],
	['miscellaneous', 'turnOverDifferential', 'Turnover diff'],
	['defensive', 'sacks', 'Sacks'],
	['defensiveInterceptions', 'interceptions', 'Interceptions'],
	['miscellaneous', 'totalPenaltyYards', 'Penalty yards']
];

export async function teamStats(id: string): Promise<TeamStats> {
	const data = await get(`${SITE}/teams/${id}/statistics`, 10 * MINUTE);
	const categories = data.results?.stats?.categories ?? [];
	const find = (category: string, stat: string) =>
		categories.find((c: Json) => c.name === category)?.stats.find((s: Json) => s.name === stat);
	return {
		highlights: TEAM_STATS.flatMap(([category, stat, label]) => {
			const s = find(category, stat);
			return s ? [{ label, value: s.displayValue, rank: s.rankDisplayValue ?? null }] : [];
		}),
		categories: categories.map((c: Json) => ({
			name: c.displayName,
			stats: c.stats
				.filter((s: Json) => s.displayValue != null)
				// ESPN repeats some stats within a category (Receiving Yards appears twice).
				.filter(
					(s: Json, i: number, all: Json[]) =>
						all.findIndex((t: Json) => t.displayName === s.displayName) === i
				)
				.map((s: Json) => ({ label: s.displayName, value: s.displayValue }))
		}))
	};
}

/* Players */

export async function player(id: string): Promise<PlayerDetail> {
	const [bio, overview] = await Promise.all([
		get(`${ATHLETES}/${id}`, HOUR),
		get(`${ATHLETES}/${id}/overview`, 10 * MINUTE)
	]);
	const a = bio.athlete;
	const season = overview.statistics;
	return {
		id: String(a.id),
		name: a.displayName,
		jersey: a.jersey ?? null,
		position: a.position?.displayName ?? null,
		headshot: a.headshot?.href ?? null,
		team: a.team ? mapTeam(a.team) : null,
		status: a.status?.name ?? null,
		facts: [
			['Age', a.age],
			['Height', a.displayHeight],
			['Weight', a.displayWeight],
			['Experience', a.displayExperience],
			['College', a.college?.name],
			['Drafted', a.displayDraft],
			['Born', a.displayBirthPlace]
		]
			.filter(([, value]) => value != null && value !== '')
			.map(([label, value]) => ({ label, value: String(value) })),
		season: season?.splits?.length
			? {
					title: season.displayName,
					labels: season.labels,
					rows: season.splits
						.filter((s: Json) => s.displayName !== 'Projected')
						.map((s: Json): StatLine => ({ label: s.displayName, values: s.stats }))
				}
			: null
	};
}

/** Where a team played under another name since 2000, by ESPN's name for it then. Its id never changed. */
const FORMER: Record<string, string> = {
	'st-louis-rams': 'STL',
	'san-diego-chargers': 'SD',
	'oakland-raiders': 'OAK'
};

/** A table for each kind of stat the player has ("Passing", "Rushing"): a row per season, then the career. */
export async function career(id: string): Promise<StatTable[]> {
	const [data, all] = await Promise.all([
		// ESPN has no stats page at all for a player without any: a rookie lineman, a coach.
		get(`${ATHLETES}/${id}/stats`, HOUR).catch((failure) => {
			if (isHttpError(failure, 404)) return null;
			throw failure;
		}),
		teams()
	]);
	const abbreviations = new Map(all.map((t) => [t.id, t.abbreviation]));
	return (data?.categories ?? [])
		.filter((c: Json) => c.statistics?.length)
		.map((c: Json): StatTable => ({
			title: c.displayName,
			labels: c.labels,
			rows: [
				// A season split between two teams is a row for each, then one without a team for the two together.
				...c.statistics.map((s: Json): StatLine => {
					const team = s.teamId
						? (FORMER[s.teamSlug] ?? abbreviations.get(String(s.teamId)))
						: 'Total';
					return {
						label: [s.season?.displayName, team].filter(Boolean).join(' '),
						values: s.stats,
						...(s.teamId ? {} : { total: true })
					};
				}),
				...(c.totals?.length ? [{ label: 'Career', values: c.totals, total: true }] : [])
			]
		}));
}

/**
 * The playoff rounds by ESPN's week number. The Super Bowl is week 5, with the Pro Bowl before it as week 4;
 * through the 2008 season the Pro Bowl came after it, and the Super Bowl was week 4.
 */
const PLAYOFF_ROUNDS: Record<number, string> = {
	1: 'Wild Card',
	2: 'Divisional',
	3: 'Conf. Champ.'
};
const playoffRound = (week: number, season: number) =>
	week === (season <= 2008 ? 4 : 5) ? 'Super Bowl' : PLAYOFF_ROUNDS[week];

/** The games of one of the player's seasons. Leave the season out for the latest one they played in. */
export async function gameLog(id: string, season?: number): Promise<GameLog> {
	// Kept as the tables themselves: the response is some 90 KB of links for a few hundred numbers.
	const url = `${ATHLETES}/${id}/gamelog${season ? `?season=${season}` : ''}`;
	const log: GameLog = await get(url, 10 * MINUTE, {
		trim: (data): GameLog => {
			const seasons = data.filters?.find((f: Json) => f.name === 'season');
			const year = Number(seasons?.value) || (season ?? 0);
			const labels: string[] = data.labels ?? [];
			// The columns run passing first, then rushing, and so on, with some labels ("YDS") in more than one.
			const groups = (data.categories ?? []).map((c: Json) => ({
				label: c.displayName,
				span: c.count
			}));
			return {
				season: year,
				seasons: (seasons?.options ?? []).map((o: Json) => Number(o.value)),
				// A player with no stats to his name (a lineman) has games but no columns.
				tables: labels.length
					? (data.seasonTypes ?? []).flatMap((type: Json) =>
							(type.categories ?? [])
								.filter((c: Json) => c.type === 'event' && c.events?.length)
								.map((c: Json): StatTable => ({
									title: type.displayName,
									labels,
									groups,
									rows: [
										...c.events.map((e: Json): StatLine => {
											const game = data.events?.[e.eventId];
											// A playoff game's week is its round: week 5 is the Super Bowl.
											const when =
												(c.splitType === '3' && playoffRound(game?.week, year)) ||
												`Wk ${game?.week}`;
											const label = game
												? `${when} ${game.atVs === '@' ? '@' : 'vs'} ${game.opponent.abbreviation} · ${game.gameResult} ${game.score}`
												: '';
											return { label, values: e.stats, gameId: String(e.eventId) };
										}),
										...(c.totals?.length ? [{ label: 'Total', values: c.totals, total: true }] : [])
									]
								}))
						)
					: []
			};
		}
	});
	// A season the player never had is as good as left out.
	return season && !log.seasons.includes(log.season) ? gameLog(id) : log;
}

/* League leaders */

/**
 * The kinds of leader, each with ESPN's filter for who's in the table, the stat groups whose columns it shows and
 * the column it sorts by to begin with. A group is spelled as ESPN's `sort` wants it; the response has it in
 * lower case.
 */
const LEADERS: Record<string, { label: string; filter: string; groups: string[]; sort: string }> = {
	passing: {
		label: 'Passing',
		filter: 'offense:passing',
		groups: ['passing'],
		sort: 'passing.passingYards'
	},
	rushing: {
		label: 'Rushing',
		filter: 'offense:rushing',
		groups: ['rushing'],
		sort: 'rushing.rushingYards'
	},
	receiving: {
		label: 'Receiving',
		filter: 'offense:receiving',
		groups: ['receiving'],
		sort: 'receiving.receivingYards'
	},
	defense: {
		label: 'Defense',
		filter: 'defense',
		groups: ['defensive', 'defensiveInterceptions'],
		sort: 'defensive.totalTackles'
	},
	scoring: {
		label: 'Scoring',
		filter: 'scoring',
		groups: ['scoring'],
		sort: 'scoring.totalPoints'
	},
	kicking: {
		label: 'Kicking',
		filter: 'specialTeams:kicking',
		groups: ['kicking'],
		sort: 'kicking.fieldGoalsMade'
	},
	punting: {
		label: 'Punting',
		filter: 'specialTeams:punting',
		groups: ['punting'],
		sort: 'punting.grossAvgPuntYards'
	},
	returning: {
		label: 'Returns',
		filter: 'specialTeams:returning',
		groups: ['returning'],
		sort: 'returning.kickReturnYards'
	}
};

const LEADERS_SHOWN = 50;
/** ESPN has every table for 1999 and none for 1990; 2000 is a round place to stop. */
const FIRST_SEASON = 2000;

/**
 * The top fifty of one regular season. An unknown category gets passing, and a sort that's from another
 * category, or that ESPN doesn't have, gets this one's own: a hand-edited address still lands on a table.
 */
export async function leaders(category?: string, sort?: string, season?: number): Promise<Leaders> {
	const key = category && Object.hasOwn(LEADERS, category) ? category : 'passing';
	const config = LEADERS[key];
	const groups = ['general', ...config.groups];
	let sorted = sort && groups.includes(sort.split('.')[0]) ? sort : config.sort;
	const asked = season && season >= FIRST_SEASON ? season : undefined;

	const table = (by: string) => {
		const params = new URLSearchParams({
			category: config.filter,
			sort: `${by}:desc`,
			seasontype: '2',
			limit: String(LEADERS_SHOWN)
		});
		if (asked) params.set('season', String(asked));
		// Kept as the table itself: fifty leaders come as 750 KB of JSON, nearly all of it logos and links.
		return get(`${COMMON}/sports/football/nfl/statistics/byathlete?${params}`, 10 * MINUTE, {
			trim: (data) => {
				const columns = groups.flatMap((group) => {
					const c = data.categories?.find((c: Json) => c.name === group.toLowerCase());
					// Of the general numbers, only games played belongs in every table.
					// And of ESPN's two "QBR" columns, the first.
					const names: string[] =
						group === 'general'
							? ['gamesPlayed']
							: (c?.names ?? []).filter((name: string) => name !== 'adjQBR');
					return names.flatMap((name) => {
						const i: number = c?.names?.indexOf(name) ?? -1;
						if (i === -1) return [];
						const column = {
							key: `${group}.${name}`,
							short: c.labels[i],
							long: c.displayNames?.[i] ?? c.labels[i]
						};
						return [{ column, group: c.name, i }];
					});
				});
				return {
					current: data.currentSeason?.year,
					season: data.requestedSeason?.year,
					columns: columns.map((c) => c.column),
					rows: (data.athletes ?? []).map((entry: Json, i: number) => ({
						rank: i + 1,
						player: {
							id: String(entry.athlete.id),
							name: entry.athlete.displayName,
							position: entry.athlete.position?.abbreviation ?? null,
							headshot: entry.athlete.headshot?.href ?? null
						},
						teamId: entry.athlete.teamId ? String(entry.athlete.teamId) : null,
						abbreviation: entry.athlete.teamShortName ?? null,
						values: columns.map(
							(c) => entry.categories?.find((g: Json) => g.name === c.group)?.totals?.[c.i] ?? '-'
						)
					}))
				};
			}
		});
	};

	const [data, all] = await Promise.all([
		// ESPN answers a stat it doesn't have in the group with a 400.
		table(sorted).catch((failure) => {
			if (sorted === config.sort || !isHttpError(failure, 400)) throw failure;
			sorted = config.sort;
			return table(sorted);
		}),
		teams()
	]);
	// ESPN only names the season it was asked for when it has something for it. One it has nothing for, or
	// from before the picker starts, is as good as left out.
	if (asked && !data.season) return leaders(key, sorted);
	const byId = new Map(all.map((t) => [t.id, t]));
	const current: number = data.current ?? new Date().getFullYear();
	return {
		category: key,
		categories: Object.entries(LEADERS).map(([key, { label }]) => ({ key, label })),
		season: data.season ?? current,
		seasons: Array.from({ length: Math.max(1, current - FIRST_SEASON + 1) }, (_, i) => current - i),
		sort: sorted,
		columns: data.columns,
		rows: data.rows.map(({ teamId, abbreviation, ...row }: Json) => {
			const team = byId.get(teamId);
			// Today's team, under the name it had that season: the 2001 Rams were "STL".
			return {
				...row,
				team: team ? { ...team, abbreviation: abbreviation ?? team.abbreviation } : null
			};
		})
	};
}

/* Search */

/** Teams by name, city or abbreviation, and ESPN's own search for players. It only knows active players. */
export async function search(query: string): Promise<SearchResults> {
	const q = query.trim().toLowerCase();
	const params = new URLSearchParams({
		query: q,
		type: 'player',
		sport: 'football',
		league: 'nfl',
		limit: '12'
	});
	const [all, found] = await Promise.all([
		teams(),
		get(`${COMMON}/search?${params}`, 10 * MINUTE, {
			keep: false,
			trim: (data) =>
				(data.items ?? [])
					// Coaches come back as players, with a position of "Unknown" (0) and no player page to go to.
					.filter((item: Json) => item.type === 'player' && item.position?.id !== '0')
					.map((item: Json) => ({
						id: String(item.id),
						name: item.displayName,
						position: item.position?.abbreviation ?? null,
						jersey: item.jersey ?? null,
						headshot: item.headshot?.href ?? null,
						teamId: String(item.teamRelationships?.[0]?.core?.id ?? '')
					}))
		}).catch((failure) => {
			// ESPN turns down a search without a letter or number in it ("..").
			if (isHttpError(failure, 400)) return [];
			throw failure;
		})
	]);
	const byId = new Map(all.map((t) => [t.id, t]));
	return {
		// "kc", "kansas", "chiefs", or the start of any of them.
		teams: all.filter(
			(t) =>
				t.abbreviation.toLowerCase().startsWith(q) ||
				t.name.toLowerCase().startsWith(q) ||
				t.name
					.toLowerCase()
					.split(' ')
					.some((word) => word.startsWith(q))
		),
		players: found.map(({ teamId, ...player }: Json) => ({
			...player,
			team: byId.get(teamId) ?? null
		}))
	};
}
