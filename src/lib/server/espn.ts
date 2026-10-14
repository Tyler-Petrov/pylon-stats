// ESPN's public site API. Unofficial and undocumented, but keyless and stable for years.
// Everything ESPN-shaped stays in this file: the rest of the app sees the types in #lib/types.js.
import { error, isHttpError } from '@sveltejs/kit';
import type {
	Conference,
	DepthUnit,
	Game,
	GameSide,
	GameState,
	Player,
	PlayerDetail,
	Roster,
	Scoreboard,
	StandingRow,
	StatLine,
	Team,
	TeamDetail,
	TeamStats
} from '#lib/types.js';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings';
const ATHLETES = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes';

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
		if (response?.status === 404) error(404, 'Not found');
		await response?.body?.cancel();
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
 */
const cache = new Map<string, { expires: number; value: Promise<Json> }>();
const lastGood = new Map<string, { until: number; data: Json }>();
const LAST_GOOD_MAX = 200;
const FALLBACK_TTL = 30 * SECOND;

function get(url: string, ttl: number): Promise<Json> {
	const now = Date.now();
	const hit = cache.get(url);
	if (hit && hit.expires > now) return hit.value;
	// Every player and week is its own URL, so drop stale entries now and then rather than keep them all.
	if (cache.size > 500)
		for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key);

	const value = request(url).then(
		(data) => {
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
		linescores: (c.linescores ?? []).map((l: Json) => l.value ?? l.displayValue)
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
							winPct(b) - winPct(a) || b.diff - a.diff || a.team.name.localeCompare(b.team.name)
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
	const log = overview.gameLog;
	// A player who hasn't played this season still gets a game log, just without any games in it.
	const logStats = log?.statistics?.find((c: Json) => c.events?.length);
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
			: null,
		gameLog: logStats
			? {
					title: logStats.displayName,
					labels: logStats.labels,
					rows: logStats.events.map((e: Json): StatLine => {
						const game = log.events?.[e.eventId];
						const label = game
							? `Wk ${game.week} ${game.atVs === '@' ? '@' : 'vs'} ${game.opponent.abbreviation} · ${game.gameResult} ${game.score}`
							: '';
						return { label, values: e.stats };
					})
				}
			: null
	};
}
