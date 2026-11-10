import { expect } from "@effect/vitest";
import { adapterBridges } from "#rules/effect/adapterBridges.ts";
import { adapterFiles } from "#test/adapterFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MANIFEST = {
	content: JSON.stringify({ dependencies: { "@anthropic-ai/claude-agent-sdk": "*", ignore: "*", "outside-http": "*" } }),
	path: "package.json",
};

const REPAIR = "This is core code under the Effect rules; move it out of adapters/.";

ruleStory.it(
	"effect/adapter-bridges reports pure path matching in adapters/ and tells the author to move it into core",
	[repositoryHas(MANIFEST, { content: adapterFiles.matchAdminRoute, path: "src/adapters/matchAdminRoute.ts" })],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([{ file: "src/adapters/matchAdminRoute.ts", message: expect.stringContaining(REPAIR) }]);
	},
);

ruleStory.it(
	"effect/adapter-bridges reports an adapter that imports its outside library only as types",
	[repositoryHas(MANIFEST, { content: adapterFiles.rawPayload, path: "src/adapters/rawPayload.ts" })],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([{ file: "src/adapters/rawPayload.ts", message: expect.stringContaining(REPAIR) }]);
	},
);

ruleStory.it(
	"effect/adapter-bridges reports an adapter whose Promises appear only in types and in unions that merely admit one",
	[
		effectResolves(),
		repositoryHas(MANIFEST, {
			content:
				'export interface Runtime {\n\treadonly dispose: () => Promise<void>;\n}\ntype Rendered = string | Promise<string>;\nfunction placeholder(): Rendered {\n\treturn "Loading";\n}\nexport const shown = placeholder();\n',
			path: "src/adapters/runtime.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([{ file: "src/adapters/runtime.ts", message: expect.stringContaining(REPAIR) }]);
	},
);

ruleStory.it(
	"effect/adapter-bridges leaves the same pure code alone in core, in tests and in test-support",
	[
		repositoryHas(
			MANIFEST,
			{ content: adapterFiles.matchAdminRoute, path: "src/matchAdminRoute.ts" },
			{ content: adapterFiles.matchAdminRoute, path: "src/adapters/matchAdminRoute.test.ts" },
			{ content: adapterFiles.matchAdminRoute, path: "src/test-support/adapters/matchAdminRoute.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([]);
	},
);

for (const [use, content] of [
	["a value import of an outside library", adapterFiles.ignorePatterns],
	["async", adapterFiles.sessionRecheck],
	["throw", adapterFiles.rethrowQueryDefect],
	["a Promise-typed parameter", adapterFiles.inspectionOperation],
	["a captured context", adapterFiles.withPolicyContext],
	["a host global", adapterFiles.clientId],
	["an unsafe clock read", adapterFiles.draftPersistence],
	["a Promise value", "const ready = Promise.withResolvers<void>();\nexport function release(): void {\n\tready.resolve();\n}\n"],
	[
		"a method of a value its outside library typed",
		'import type { IncomingMessage } from "outside-http";\nexport function closeSignal(request: IncomingMessage): AbortSignal {\n\tconst controller = new AbortController();\n\trequest.once("close", () => controller.abort());\n\treturn controller.signal;\n}\n',
	],
] as const) {
	ruleStory.it(
		`effect/adapter-bridges accepts an adapter that uses ${use}`,
		[
			effectResolves(),
			repositoryHas(
				MANIFEST,
				{ content: '{"name":"outside-http","types":"index.d.ts"}', path: "node_modules/outside-http/package.json" },
				{
					content: 'export interface IncomingMessage { once(event: "close", listener: () => void): this; }\n',
					path: "node_modules/outside-http/index.d.ts",
				},
				{ content, path: "src/adapters/bridge.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(adapterBridges);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"effect/adapter-bridges accepts a service folder in adapters/ whose operations bridge beside a pure declaration and a pure operation",
	[
		repositoryHas(
			MANIFEST,
			{ content: adapterFiles.importCompilerService, path: "src/adapters/import-compiler/service.ts" },
			{ content: adapterFiles.importCompilerDepartures, path: "src/adapters/import-compiler/departures.ts" },
			{ content: adapterFiles.ignorePatterns, path: "src/adapters/import-compiler/graph.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"effect/adapter-bridges reports a service folder in adapters/ when none of its files bridges",
	[
		repositoryHas(
			MANIFEST,
			{ content: adapterFiles.importCompilerService, path: "src/adapters/import-compiler/service.ts" },
			{ content: adapterFiles.importCompilerDepartures, path: "src/adapters/import-compiler/departures.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings.map((finding) => finding.file).toSorted()).toEqual([
			"src/adapters/import-compiler/departures.ts",
			"src/adapters/import-compiler/service.ts",
		]);
	},
);
