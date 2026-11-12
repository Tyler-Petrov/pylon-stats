// Deploys main to production by dispatching the Deploy production workflow, then watches it.
// The only way to release; never run `wrangler deploy` by hand.

import { cancel, confirm, isCancel } from '@clack/prompts';
import { spawnSync } from 'node:child_process';

function gh(...args) {
	const result = spawnSync('gh', args, { encoding: 'utf8' });
	if (result.status !== 0) {
		console.error(result.stderr || result.error?.message);
		process.exit(1);
	}
	return result.stdout.trim();
}

const [lastRun] = JSON.parse(
	gh(
		'run',
		'list',
		'--workflow',
		'deploy-production.yml',
		'--limit',
		'1',
		'--json',
		'displayTitle,conclusion,status'
	)
);
if (lastRun && lastRun.status !== 'completed') {
	console.error('A production release is already running. Wait for it to finish.');
	process.exit(1);
}
// The commit main points at now. The workflow deploys exactly this, so a merge after confirming
// can't change what ships.
const [sha, ...subject] = gh(
	'api',
	'repos/{owner}/{repo}/commits/main',
	'--jq',
	'.sha + " " + (.commit.message | split("\\n")[0])'
).split(' ');
// The run's name carries the commit it released.
if (lastRun?.conclusion === 'success' && lastRun.displayTitle.includes(sha)) {
	console.log('Nothing to release: main is already live.');
	process.exit(0);
}

const confirmed = await confirm({
	message: `Deploy ${sha.slice(0, 7)} "${subject.join(' ')}" to pylon.tpetrov.dev?`,
	initialValue: false
});
if (isCancel(confirmed) || !confirmed) {
	cancel('Release cancelled.');
	process.exit(1);
}

const dispatched = gh(
	'workflow',
	'run',
	'deploy-production.yml',
	'--ref',
	'main',
	'-f',
	`sha=${sha}`,
	'-f',
	'confirm_production=true'
);
const runId = dispatched.match(/\/actions\/runs\/(\d+)/)?.[1];
if (!runId) {
	console.error('Deploy dispatched, but gh did not return its run URL, so it cannot be watched.');
	process.exit(1);
}
console.log(`Deploy dispatched: ${dispatched}`);
const watch = spawnSync('gh', ['run', 'watch', runId, '--exit-status'], { stdio: 'inherit' });
process.exit(watch.status ?? 1);
