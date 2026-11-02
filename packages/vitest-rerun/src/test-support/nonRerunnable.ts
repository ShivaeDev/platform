import { rerunStory } from "./kit.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

export function workerCrashesOnce() {
	return rerunStory.trait("tests", "a worker exits during its first test execution and would pass on a rerun", (suite) =>
		writeFile(
			suite,
			"crash.spec.ts",
			perAttempt(`
it('exits the worker once', () => {
	appendFileSync('ran.txt', 'worker execution\\n');
	if (attempt === 1) process.kill(process.pid, 'SIGKILL');
});
`),
		),
	);
}

export function externalSetupFailsOnce() {
	return rerunStory.trait("configuration", "global setup fails on its first execution and would pass on a rerun", (suite) => {
		suite.config.globalSetup = "./global-setup.ts";
		writeFile(
			suite,
			"global-setup.ts",
			`import { appendFileSync, readFileSync } from 'node:fs';

export default function setup() {
	appendFileSync('ran.txt', 'external setup\\n');
	const attempts = readFileSync('ran.txt', 'utf8').trim().split('\\n').length;
	if (attempts === 1) throw new Error('External setup fails once');
}
`,
		);
	});
}
