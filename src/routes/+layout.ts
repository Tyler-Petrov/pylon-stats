// Pages show kickoff times in the visitor's own time zone, which the server doesn't know, so render in the
// browser. The data still comes from the server, through the remote functions in lib/nfl.remote.ts.
export const ssr = false;
