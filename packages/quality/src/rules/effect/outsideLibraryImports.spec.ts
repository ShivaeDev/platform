import { expect } from "@effect/vitest";
import { adapterImports } from "#rules/effect/adapterImports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"effect/adapter-imports accepts core and client modules that import, re-export, load and call outside libraries",
	[
		repositoryHas(
			{
				content:
					'{"dependencies":{"yaml":"*","@tanstack/react-query":"*","recharts":"*"},"peerDependencies":{"vitest":"*"},"optionalDependencies":{"shiki":"*"}}',
				path: "package.json",
			},
			{
				content:
					'import { parse } from "yaml";\nimport "shiki";\nexport { stringify } from "yaml";\nconst lazy = import("yaml");\nconst yaml = require("yaml");\nimport old = require("yaml");\nexport const settings = parse("a: 1");',
				path: "src/core.ts",
			},
			{ content: 'import { BarChart } from "recharts";\nexport const chart = BarChart;', path: "src/server/chart.ts" },
			{ content: 'import { defineConfig } from "vitest/config";\nexport const appTestConfig = defineConfig({});', path: "src/appTestConfig.ts" },
			{ content: 'import { useQuery } from "@tanstack/react-query";\nexport const useNotes = () => useQuery;', path: "src/client/notes.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"effect/adapter-imports reports a Node builtin in core code at its import site",
	[
		repositoryHas(
			{ content: '{"dependencies":{"yaml":"*"}}', path: "package.json" },
			{ content: '\nimport { parse } from "yaml";\nimport { readFile } from "node:fs/promises";', path: "src/core.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(findings).toEqual([
			{
				file: "src/core.ts",
				line: 3,
				message:
					'Imports Node builtin "node:fs/promises" as a value. Use Effect\'s FileSystem, ChildProcessSpawner, Config and other platform services, or bridge it in an adapters/ module with explicit imports that exposes Effect values; use import type for types. Read environment variables with Config instead of process.env, including in adapters/.',
			},
		]);
	},
);

for (const path of ["src/adapters/core.ts", "src/nested/adapters/core.ts", "src/test-support/kit.ts"]) {
	ruleStory.it(
		`effect/adapter-imports accepts Node builtins in ${path}`,
		[repositoryHas({ content: "{}", path: "package.json" }, { content: 'import { readFile } from "node:fs/promises";\nimport os from "os";', path })],
		function* ({ check }) {
			const findings = yield* check(adapterImports);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"effect/adapter-imports reports Node builtins in every value import form, in client code and in specs, and accepts type imports",
	[
		repositoryHas(
			{ content: "{}", path: "package.json" },
			{
				content:
					'import { readFile } from "node:fs/promises";\nimport fs from "fs";\nimport "node:os";\nexport { cpus } from "node:os";\nconst lazy = import("node:os");\nconst os = require("node:os");\nimport old = require("node:os");\nimport type { Stats } from "node:fs";\nimport { type Dirent } from "node:fs";',
				path: "src/core.ts",
			},
			{ content: 'import "node:fs/promises";', path: "src/client/core.ts" },
			{ content: 'import { readFileSync } from "node:fs";', path: "src/core.spec.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(findings.map(({ file, line }) => `${file}:${line}`).sort()).toEqual([
			"src/client/core.ts:1",
			"src/core.spec.ts:1",
			...Array.from({ length: 7 }, (_, index) => `src/core.ts:${index + 1}`),
		]);
	},
);
