import { adapterImports } from "#rules/effect/adapterImports.ts";
import { effectBoundary } from "#rules/effect/boundary.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const WORKSPACE = { content: '{"name":"@demo/workspace","workspaces":["packages/*"],"devDependencies":{"vitest":"*"}}', path: "package.json" };

const KIT = { content: '{"name":"@demo/kit","devDependencies":{"vitest":"*"},"peerDependencies":{"vitest":"*"}}', path: "packages/kit/package.json" };

const TOOL_CONFIG = `import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

const test = testProjects();
for (const project of test.projects ?? []) {
	if (typeof project === "object" && "test" in project && project.test?.name === "dom") {
		project.test.environment = fileURLToPath(import.meta.resolve("@shivaedev/test-story/server/adapters/domEnvironment.config.ts"));
	}
}

export default defineConfig({ test });
`;

const CONFIG_LOADER = `export default async function workspace() {
	const { default: config } = await import("./other.config.ts");
	if (config === undefined) {
		throw new Error("expected a config");
	}
	return config;
}
`;

for (const path of ["vitest.config.ts", "packages/kit/vitest.config.ts"]) {
	ruleStory.it(
		`effect/adapter-imports accepts Node and tool imports in the package-root tool config ${path}, which the tool loads from its fixed path`,
		[repositoryHas(WORKSPACE, KIT, { content: TOOL_CONFIG, path })],
		function* ({ check }) {
			yield* assertThat(yield* check(adapterImports), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"effect/adapter-imports still reports Node imports in a config deeper in src/ and accepts its tool imports",
	[repositoryHas(WORKSPACE, KIT, { content: TOOL_CONFIG, path: "packages/kit/src/domEnvironment.config.ts" })],
	function* ({ check, locations }) {
		yield* check(adapterImports);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["packages/kit/src/domEnvironment.config.ts:1"]));
	},
);

ruleStory.it(
	"effect/boundary accepts Promise syntax in a package-root tool config and still reports it in a config deeper in src/",
	[
		repositoryHas(
			WORKSPACE,
			KIT,
			{ content: CONFIG_LOADER, path: "packages/kit/vitest.config.ts" },
			{ content: CONFIG_LOADER, path: "packages/kit/src/loader.config.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(effectBoundary);

		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual(["packages/kit/src/loader.config.ts:1", "packages/kit/src/loader.config.ts:2", "packages/kit/src/loader.config.ts:4"]),
		);
	},
	CLI_TIMEOUT,
);

const COMMAND = `import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";

const plan = Effect.sync(() => process.cwd());
`;

for (const [path, content] of [
	["src/cli.ts", `#!/usr/bin/env node\nimport process from "node:process";\n${COMMAND}`],
	["src/plan.ts", `import process from "node:process";\n${COMMAND}NodeRuntime.runMain(plan);\n`],
	[
		"src/attempt.ts",
		`import process from "node:process";\nimport { fileURLToPath } from "node:url";\n${COMMAND}if (fileURLToPath(import.meta.url) === process.argv[1]) {\n\tNodeRuntime.runMain(plan);\n}\n`,
	],
] as const) {
	ruleStory.it(
		`effect/adapter-imports accepts node:process in the entry module ${path} and reports its other Node imports`,
		[repositoryHas({ content: "{}", path: "package.json" }, { content, path })],
		function* ({ check, locations }) {
			yield* check(adapterImports);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual(path === "src/attempt.ts" ? ["src/attempt.ts:2"] : []));
		},
	);
}

ruleStory.it(
	"effect/adapter-imports reports node:fs in an entry and node:process in a module that is not an entry or in a spec",
	[
		repositoryHas(
			{ content: "{}", path: "package.json" },
			{ content: `import { readFileSync } from "node:fs";\n${COMMAND}NodeRuntime.runMain(plan);\n`, path: "src/cli.ts" },
			{ content: 'import process from "node:process";\nexport const write = (line: string) => process.stdout.write(line);\n', path: "src/run.ts" },
			{ content: `import process from "node:process";\n${COMMAND}NodeRuntime.runMain(plan);\n`, path: "src/cli.spec.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(adapterImports);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/cli.spec.ts:1", "src/cli.ts:1", "src/run.ts:1"]));
	},
);
