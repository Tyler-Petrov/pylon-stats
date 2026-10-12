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

export type StatLine = { label: string; values: string[] };

export type StatTable = { title: string; labels: string[]; rows: StatLine[] };

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
	gameLog: StatTable | null;
};
