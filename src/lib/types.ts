// The app's own shapes for NFL data. lib/server/espn.ts maps ESPN's responses into these.

export type Team = {
	id: string;
	abbreviation: string;
	/** "Kansas City Chiefs" */
	name: string;
	location: string;
	nickname: string;
	/** A hex colour that reads on the dark page. */
	color: string;
	logo: string;
};

export type TeamDetail = Team & {
	record: string;
	home: string | null;
	road: string | null;
	/** "1st in AFC West" */
	standing: string | null;
	pointsFor: number | null;
	pointsAgainst: number | null;
	/** Positive for a winning streak, negative for a losing one. */
	streak: number | null;
	venue: string | null;
};

export type GameState = 'pre' | 'in' | 'post';

export type GameSide = {
	team: Team;
	homeAway: 'home' | 'away';
	score: number | null;
	winner: boolean | null;
	record: string | null;
	linescores: number[];
};

export type Game = {
	id: string;
	date: string;
	name: string;
	week: number | null;
	state: GameState;
	/** "Final", "Q3 4:12", "10/25 - 8:20 PM EDT" */
	detail: string;
	venue: string | null;
	broadcast: string | null;
	odds: string | null;
	situation: {
		downDistance: string | null;
		possession: string | null;
		redZone: boolean;
		lastPlay: string | null;
	} | null;
	home: GameSide;
	away: GameSide;
};

export type Scoreboard = {
	season: number;
	seasonType: number;
	week: number;
	weeks: { seasonType: number; week: number; label: string; start: string }[];
	byes: Team[];
	games: Game[];
};

export type StandingRow = {
	team: Team;
	wins: number;
	losses: number;
	ties: number;
	pct: string;
	pointsFor: number;
	pointsAgainst: number;
	diff: number;
	streak: string;
	seed: number | null;
	home: string;
	road: string;
	division: string;
	conference: string;
};

export type Conference = {
	/** "AFC" or "NFC" */
	name: string;
	logo: string;
	color: string;
	divisions: { name: string; teams: StandingRow[] }[];
};

export type Player = {
	id: string;
	name: string;
	jersey: string | null;
	position: string | null;
	age: number | null;
	height: string | null;
	weight: string | null;
	experience: number | null;
	college: string | null;
	headshot: string | null;
	/** "Questionable", "Out", … when the player is on the injury report. */
	injury: string | null;
};

export type DepthUnit = {
	name: 'Offense' | 'Defense' | 'Special teams';
	/** ESPN's formation for the unit, "3WR 1TE" or "Base 4-3 D". */
	formation: string;
	/** Each spot in the lineup ("QB", "LT", "WR1"), with its players starter first. */
	slots: { label: string; players: Player[] }[];
};

export type Roster = {
	coach: string | null;
	/** Empty when ESPN has no depth chart for the team. */
	depth: DepthUnit[];
	/** Everyone the depth chart doesn't cover: injured reserve, practice squad, and so on. */
	groups: { name: string; players: Player[] }[];
};

export type TeamStats = {
	highlights: { label: string; value: string; rank: string | null }[];
	categories: { name: string; stats: { label: string; value: string }[] }[];
};

export type StatLine = {
	label: string;
	values: string[];
	/** The game a game log row is for. */
	gameId?: string;
	/** The row adds up the ones above it: a career, a season. */
	total?: boolean;
};

export type StatTable = {
	title: string;
	labels: string[];
	/** What the columns fall under ("Passing" over the first eleven), when a table mixes kinds of stat. */
	groups?: { label: string; span: number }[];
	rows: StatLine[];
};

export type PlayerDetail = {
	id: string;
	name: string;
	jersey: string | null;
	position: string | null;
	headshot: string | null;
	team: Team | null;
	status: string | null;
	facts: { label: string; value: string }[];
	season: StatTable | null;
};

/** A player's games in one season: a table for the regular season and one for the playoffs, latest first. */
export type GameLog = {
	season: number;
	/** Every season the player has games in, latest first. */
	seasons: number[];
	tables: StatTable[];
};

/** A column of a stat table, with the key that sorts by it. */
export type StatColumn = { key: string; short: string; long: string };

export type LeaderCategory = { key: string; label: string };

/** The league's players in one kind of stat for one regular season, best first by the sorted column. */
export type Leaders = {
	category: string;
	categories: LeaderCategory[];
	season: number;
	/** Latest first. */
	seasons: number[];
	sort: string;
	columns: StatColumn[];
	rows: {
		rank: number;
		player: { id: string; name: string; position: string | null; headshot: string | null };
		team: Team | null;
		values: string[];
	}[];
};

export type SearchResults = {
	teams: Team[];
	players: {
		id: string;
		name: string;
		position: string | null;
		jersey: string | null;
		headshot: string | null;
		team: Team | null;
	}[];
};

/** One category of a game's box score for one team, "Passing" or "Defense": a row per player. */
export type BoxScoreTable = {
	name: string;
	/** Column headings ("C/ATT", "YDS"), with what each stands for. */
	labels: { short: string; long: string }[];
	rows: { player: { id: string; name: string }; values: string[] }[];
	/** The team's line, when ESPN sends one. */
	totals: string[] | null;
};

export type GameDetail = Game & {
	/** Before kickoff, each team's season averages; after, the game's own numbers. */
	teamStats: {
		title: string;
		rows: { label: string; away: string; home: string; sub: boolean }[];
	};
	/** Away team first. Each team's categories line up by name. Empty before kickoff. */
	boxScore: { team: Team; tables: BoxScoreTable[] }[];
	scoring: {
		period: number;
		clock: string;
		team: Team;
		/** "TD", "FG" */
		kind: string;
		text: string;
		away: number;
		home: number;
	}[];
	attendance: number | null;
};

export type Play = {
	id: string;
	period: number;
	clock: string;
	/** "1st & 10 at SF 28". Null for a kickoff, a timeout, the end of a quarter. */
	down: string | null;
	text: string;
	scoring: boolean;
};

/** One possession, and every play in it in the order they happened. */
export type Drive = {
	id: string;
	team: Team | null;
	/** The quarter it started in. */
	period: number;
	/** "Touchdown", "Punt". Null while the drive is still going. */
	result: string | null;
	/** Whether anyone scored on it. */
	scored: boolean;
	/** "8 plays, 72 yards, 4:51" */
	summary: string;
	/**
	 * The score once the drive was over, and the side that raised it: not always the one with the ball (a
	 * pick-six, a safety). Null when ESPN's plays don't add up to the game's final score, as on some old games.
	 */
	score: { away: number; home: number; by: 'away' | 'home' | null } | null;
	plays: Play[];
};
