import { rerunStory } from "./kit.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

export function timesOutOnce() {
	return rerunStory.trait(
		"tests",
		'in timeout.spec.ts, "recovers after a timeout" times out after 50ms on its first attempt and passes on rerun',
		(suite) =>
			writeFile(
				suite,
				"timeout.spec.ts",
				perAttempt(`
it('recovers after a timeout', async () => {
	if (attempt === 1) {
		await new Promise(() => {});
	}
}, 50);
`),
			),
	);
}
