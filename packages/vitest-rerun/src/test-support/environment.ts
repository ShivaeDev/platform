import { fileURLToPath } from "node:url";
import { rerunStory } from "#test/kit.ts";
import { NODE_ENV_SEEN, recordEnvironment } from "#test/specFiles.ts";
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

export function configAndGlobalSetupRecordEnvironment() {
	return rerunStory.trait(
		"configuration",
		"the Vitest config, as it loads, and its global setup, as it runs, each write the NODE_ENV, TEST and VITEST they see",
		(suite) => {
			suite.config.recordsEnvironment = true;
			suite.config.globalSetup = "./global-setup.ts";
			writeFile(
				suite,
				"global-setup.ts",
				`import { writeFileSync } from 'node:fs';\n\nexport default function setup() {\n\t${recordEnvironment("global setup")}\n}\n`,
			);
		},
	);
}

export function callerSets(variables: Readonly<Record<string, string>>) {
	const settings = Object.entries(variables).map(([name, value]) => `${name}=${value}`);
	return rerunStory.trait("configuration", `the executable's caller sets ${settings.join(" and ")}`, (suite) => {
		suite.config.env = { ...suite.config.env, ...variables };
	});
}
