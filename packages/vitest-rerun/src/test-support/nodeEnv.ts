import { fileURLToPath } from "node:url";
import { rerunStory } from "#test/kit.ts";
import { NODE_ENV_SEEN } from "#test/specFiles.ts";
import { writeFile } from "#test/suite.ts";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));

export function recordsNodeEnv() {
	return rerunStory.trait("tests", 'in mode.spec.ts, "records its mode" writes the NODE_ENV it sees', (suite) =>
		writeFile(
			suite,
			"mode.spec.ts",
			`import { writeFileSync } from 'node:fs';
import { it } from ${vitest};

it('records its mode', () => {
	writeFileSync(${JSON.stringify(NODE_ENV_SEEN)}, process.env.NODE_ENV ?? 'unset');
});
`,
		),
	);
}

export function callerSetsNodeEnv(mode: string) {
	return rerunStory.trait("configuration", `the executable's caller sets NODE_ENV to ${mode}`, (suite) => {
		suite.config.env = { ...suite.config.env, "NODE_ENV": mode };
	});
}
