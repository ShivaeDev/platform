import { fileURLToPath } from "node:url";
import { rerunStory } from "./kit.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

export function hookFails(
	hook: "beforeAll" | "afterAll",
	options: { readonly nested?: boolean; readonly failures?: number; readonly skipRerun?: boolean; readonly testFailsOnRerun?: boolean } = {},
) {
	const { nested = false, failures = 1, skipRerun = false, testFailsOnRerun = false } = options;
	return rerunStory.trait(
		"tests",
		`${nested ? "a nested suite's" : "the file's"} ${hook} fails ${failures} attempts${skipRerun ? ", then the suite is skipped" : ""}${testFailsOnRerun ? ", and a passing test fails on rerun" : ""}`,
		(suite) => {
			const body = `
${hook}(() => {
	appendFileSync('ran.txt', '${hook}\\n');
	if (attempt <= ${failures}) throw new Error('${hook} failure ' + attempt);
});
it('uses the fixture', () => {
	appendFileSync('ran.txt', 'uses the fixture\\n');
	if (${testFailsOnRerun} && attempt > 1) throw new Error('New test failure');
});`;
			const wrapped = nested
				? `describe('outer', () => {\n(attempt > 1 && ${skipRerun} ? describe.skip : describe)('inner', () => {${body}\n});\n});`
				: body;
			writeFile(
				suite,
				"hooks.spec.ts",
				perAttempt(`import { beforeAll, afterAll } from ${JSON.stringify(fileURLToPath(import.meta.resolve("vitest")))};\n${wrapped}`),
			);
		},
	);
}
