import { rerunStory } from "./kit.ts";
import { holdRerun } from "./pendingAttempt.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

export function pendingRerun() {
	return rerunStory.trait("tests", "a test fails first and signals when its rerun is pending", holdRerun);
}

export function rerunLeavesUnhandledError() {
	return rerunStory.trait("tests", "a test fails first, then passes with an unhandled error in the rerun", (suite) =>
		writeFile(
			suite,
			"unhandled.spec.ts",
			perAttempt(`
it('recovers with an unhandled error', async () => {
	if (attempt === 1) {
		throw new Error('The first attempt fails');
	}
	setTimeout(() => { throw new Error('Unhandled rerun error'); }, 0);
	await new Promise((resolve) => setTimeout(resolve, 0));
});
`),
		),
	);
}

export function snapshotsAcrossAttempts() {
	return rerunStory.trait(
		"tests",
		"snapshots match in a passing file, beside a failed test, and after that test recovers on its third attempt",
		(suite) => {
			writeFile(
				suite,
				"snapshots.spec.ts",
				perAttempt(`
it('matches after recovery', () => {
	if (attempt < 3) {
		throw new Error('Not yet recovered');
	}
	expect('recovered').toMatchInlineSnapshot('"recovered"');
});
it('matches beside the failure', () => {
	expect('beside').toMatchInlineSnapshot('"beside"');
});
`),
			);
			writeFile(
				suite,
				"passing.spec.ts",
				perAttempt(
					`
it('matches in a passing file', () => {
	expect('passing').toMatchInlineSnapshot('"passing"');
});
`,
					"passing-collections.txt",
				),
			);
		},
	);
}
