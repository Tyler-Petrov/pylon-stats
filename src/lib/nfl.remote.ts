// Remote functions the pages await. Each runs on the server, where lib/server/espn.ts caches ESPN.
import { query } from '$app/server';
import { z } from 'zod';
import * as espn from '#lib/server/espn.js';

const id = z.string().regex(/^\d+$/, 'Expected a numeric ESPN id');

export const getTeams = query(() => espn.teams());

export const getTeam = query(id, (teamId) => espn.team(teamId));

export const getSchedule = query(id, (teamId) => espn.schedule(teamId));

export const getRoster = query(id, (teamId) => espn.roster(teamId));

export const getTeamStats = query(id, (teamId) => espn.teamStats(teamId));

export const getStandings = query(() => espn.standings());

export const getPlayer = query(id, (playerId) => espn.player(playerId));

/** A week of games. Leave both out for the current week. */
export const getScoreboard = query(
	z.object({
		week: z.number().int().min(1).max(23).optional(),
		seasonType: z.number().int().min(1).max(4).optional()
	}),
	({ week, seasonType }) => espn.scoreboard(week, seasonType)
);
