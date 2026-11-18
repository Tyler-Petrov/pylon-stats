// Remote functions the pages await. Each runs on the server, where lib/server/espn.ts caches ESPN.
import { query } from '$app/server';
import { z } from 'zod';
import * as espn from '#lib/server/espn.js';
import { SEASONS, SORT } from '#lib/query.js';

const id = z.string().regex(/^\d+$/, 'Expected a numeric ESPN id');
const season = z.number().int().min(SEASONS.min).max(SEASONS.max).optional();

export const getTeams = query(() => espn.teams());

export const getTeam = query(id, (teamId) => espn.team(teamId));

export const getSchedule = query(id, (teamId) => espn.schedule(teamId));

export const getRoster = query(id, (teamId) => espn.roster(teamId));

export const getTeamStats = query(id, (teamId) => espn.teamStats(teamId));

export const getStandings = query(() => espn.standings());

export const getPlayer = query(id, (playerId) => espn.player(playerId));

export const getCareer = query(id, (playerId) => espn.career(playerId));

/** One season of a player's games. Leave the season out for the latest one they played in. */
export const getGameLog = query(z.object({ id, season }), ({ id, season }) =>
	espn.gameLog(id, season)
);

export const getGame = query(id, (gameId) => espn.game(gameId));

export const getPlays = query(id, (gameId) => espn.plays(gameId));

/** The league's top players in a kind of stat. Everything left out gets its default: passing yards, this season. */
export const getLeaders = query(
	z.object({
		category: z.string().max(20).optional(),
		sort: z.string().regex(SORT).optional(),
		season
	}),
	({ category, sort, season }) => espn.leaders(category, sort, season)
);

export const getSearchResults = query(z.string().trim().min(2).max(40), (text) =>
	espn.search(text)
);

/** A week of games. Leave both out for the current week. */
export const getScoreboard = query(
	z.object({
		week: z.number().int().min(1).max(23).optional(),
		seasonType: z.number().int().min(1).max(4).optional()
	}),
	({ week, seasonType }) => espn.scoreboard(week, seasonType)
);
