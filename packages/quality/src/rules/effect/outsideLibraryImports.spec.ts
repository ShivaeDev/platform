import { expect } from "@effect/vitest";
import { adapterImports } from "#rules/effect/adapterImports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const name of ["better-auth", "pg-boss", "@tanstack/react-router", "vitest", "shiki", "yaml"]) {
	for (const field of ["dependencies", "peerDependencies"]) {
		ruleStory.it(
			`effect/adapter-imports reports ${name} from ${field} at its import site`,
			[
				repositoryHas(
					{ content: JSON.stringify({ [field]: { [name]: "*" } }), path: "package.json" },
					{ content: `\nimport { value } from "${name}";\nexport const result = value;`, path: "src/core.ts" },
				),
			],
			function* ({ check }) {
				const findings = yield* check(adapterImports);

				expect(findings).toEqual([
					{
						file: "src/core.ts",
						line: 2,
						message: `Imports outside library "${name}" as a value. Move the integration into an adapters/ folder and expose Effect values; use import type for types.`,
					},
				]);
			},
		);
	}
}

for (const path of ["src/adapters/core.ts", "src/nested/adapters/core.ts", "src/test-support/kit.ts"]) {
	ruleStory.it(
		`effect/adapter-imports accepts outside libraries in ${path}`,
		[
			repositoryHas(
				{ content: '{"dependencies":{"yaml":"*"}}', path: "package.json" },
				{ content: 'import { parse } from "yaml";\nimport { readFile } from "node:fs/promises";', path },
			),
		],
		function* ({ check }) {
			expect(yield* check(adapterImports)).toEqual([]);
		},
	);
}

ruleStory.it(
	"effect/adapter-imports accepts Effect, platform-node, type imports, dev tools and React in client UI folders",
	[
		repositoryHas(
			{
				content:
					'{"dependencies":{"effect":"*","@effect/platform-node":"*","yaml":"*","react":"*","react-dom":"*"},"devDependencies":{"vitest":"*"}}',
				path: "package.json",
			},
			{
				content:
					'import { Effect } from "effect";\nimport { NodeRuntime } from "@effect/platform-node";\nimport { NodeFileSystem } from "@effect/platform-node/NodeFileSystem";\nimport type YAML from "yaml";\nimport { type Document } from "yaml";\nexport { type Document } from "yaml";\nimport { test } from "@effect/vitest";',
				path: "src/core.ts",
			},
			{ content: 'import { useState } from "react";\nimport { createRoot } from "react-dom/client";', path: "src/client/ui.tsx" },
			{ content: 'import { Document } from "yaml";', path: "src/value.d.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(adapterImports)).toEqual([]);
	},
);

ruleStory.it(
	"effect/adapter-imports checks Node, React outside client folders, optional dependencies and every runtime loading form",
	[
		repositoryHas(
			{ content: '{"dependencies":{"react":"*"},"optionalDependencies":{"yaml":"*"}}', path: "package.json" },
			{
				content:
					'import { readFile } from "node:fs/promises";\nimport fs from "fs";\nimport { useState } from "react";\nimport "yaml";\nexport { parse } from "yaml";\nconst lazy = import("yaml");\nconst yaml = require("yaml");\nimport old = require("yaml");',
				path: "src/core.ts",
			},
			{ content: 'import { type Document, parse } from "yaml";', path: "src/client/core.ts" },
			{ content: 'import { test } from "react";', path: "src/core.spec.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(findings.map(({ file, line }) => `${file}:${line}`).sort()).toEqual([
			"src/client/core.ts:1",
			"src/core.spec.ts:1",
			...Array.from({ length: 8 }, (_, index) => `src/core.ts:${index + 1}`),
		]);
	},
);

ruleStory.it(
	"effect/adapter-imports uses the owning workspace manifest and accepts workspace modules and local aliases",
	[
		repositoryHas(
			{ content: '{"workspaces":["packages/*"],"dependencies":{"shiki":"*"}}', path: "package.json" },
			{
				content: '{"name":"@demo/core","dependencies":{"yaml":"*","@demo/other":"*"},"imports":{"#local":"./src/local.ts"}}',
				path: "packages/core/package.json",
			},
			{ content: '{"name":"@demo/other","exports":"./index.ts"}', path: "packages/other/package.json" },
			{ content: "export const value = 1;", path: "packages/other/index.ts" },
			{ content: "export const value = 1;", path: "packages/core/src/local.ts" },
			{ content: 'import { value } from "#local";\nimport "@demo/other";\nimport "shiki";\nimport "yaml";', path: "packages/core/src/core.ts" },
			{ content: '{"name":"yaml","types":"index.d.ts"}', path: "packages/core/node_modules/yaml/package.json" },
			{ content: "export const value: number;", path: "packages/core/node_modules/yaml/index.d.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(findings.map(({ file, line }) => `${file}:${line}`)).toEqual(["packages/core/src/core.ts:4"]);
	},
);

ruleStory.it(
	"effect/adapter-imports accepts installed native Effect framework packages in consumers",
	[
		repositoryHas(
			{ content: '{"dependencies":{"@shivaedev/platform":"*"}}', path: "package.json" },
			{ content: 'import { errors } from "@shivaedev/platform";', path: "src/core.ts" },
			{ content: '{"name":"@shivaedev/platform","main":"index.js"}', path: "node_modules/@shivaedev/platform/package.json" },
			{ content: "export const errors = {};", path: "node_modules/@shivaedev/platform/index.js" },
		),
	],
	function* ({ check }) {
		expect(yield* check(adapterImports)).toEqual([]);
	},
);
