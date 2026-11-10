import { expect } from "@effect/vitest";
import { adapterBridges } from "#rules/effect/adapterBridges.ts";
import { adapterFiles } from "#test/adapterFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { outsideLibrary } from "#test/outsideLibrary.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MANIFEST = {
	content: JSON.stringify({
		dependencies: { "@anthropic-ai/claude-agent-sdk": "*", "better-auth": "*", ignore: "*", "outside-http": "*", react: "*" },
	}),
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
	"effect/adapter-bridges reports an adapter that only builds URLs, since URL and URLSearchParams are data classes and not the DOM",
	[effectResolves(), repositoryHas(MANIFEST, { content: adapterFiles.clientConnection, path: "src/adapters/clientConnection.ts" })],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([{ file: "src/adapters/clientConnection.ts", message: expect.stringContaining(REPAIR) }]);
	},
);

for (const [place, file, content] of [
	["inside an Effect combinator's callback", "inspectionDeferrals.ts", adapterFiles.inspectionDeferrals],
	["as part of an Effect pipeline", "makeOpencodeServer.ts", adapterFiles.makeOpencodeServer],
] as const) {
	ruleStory.it(
		`effect/adapter-bridges reports an adapter whose Unsafe Effect call runs ${place}`,
		[effectResolves(), repositoryHas(MANIFEST, { content, path: `src/adapters/${file}` })],
		function* ({ check }) {
			const findings = yield* check(adapterBridges);

			expect(findings).toEqual([{ file: `src/adapters/${file}`, message: expect.stringContaining(REPAIR) }]);
		},
	);
}

ruleStory.it(
	"effect/adapter-bridges reports an adapter whose outside library type never leaves the file",
	[
		effectResolves(),
		repositoryHas(MANIFEST, ...outsideLibrary("better-auth", "export interface BetterAuthOptions {\n\treadonly [key: string]: unknown;\n}\n"), {
			content: adapterFiles.authOptions,
			path: "src/adapters/authOptions.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(adapterBridges);

		expect(findings).toEqual([{ file: "src/adapters/authOptions.ts", message: expect.stringContaining(REPAIR) }]);
	},
);

for (const [shape, library, declarations, file, content] of [
	[
		"a signature that names",
		"@anthropic-ai/claude-agent-sdk",
		'export type SDKMessage = { readonly type: "assistant" } | { readonly type: "result"; readonly subtype: string };\n',
		"rawPayload.ts",
		adapterFiles.rawPayload,
	],
	[
		"an inferred result that carries",
		"react",
		"export interface InputEvent<T = Element> {\n\treadonly currentTarget: T;\n}\n",
		"numberInput.ts",
		adapterFiles.numberInput,
	],
] as const) {
	ruleStory.it(
		`effect/adapter-bridges accepts an adapter whose export has ${shape} a type its outside library declares`,
		[effectResolves(), repositoryHas(MANIFEST, ...outsideLibrary(library, declarations), { content, path: `src/adapters/${file}` })],
		function* ({ check }) {
			const findings = yield* check(adapterBridges);

			expect(findings).toEqual([]);
		},
	);
}

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
	["an unsafe nanosecond clock read", adapterFiles.traceDiagnostics],
	["a DOM call on a value the default library types", adapterFiles.screenDialogs],
	["a process runner", adapterFiles.defineScript],
	["a runner handed to code that is not Effect", adapterFiles.clientErrorReporter],
	["an Unsafe Effect call from a plain function", adapterFiles.openLiveHints],
	["an Unsafe Effect call from a socket callback", adapterFiles.discordGateway],
	[
		"a managed runtime",
		'import { Effect, Layer, ManagedRuntime } from "effect";\nconst runtime = ManagedRuntime.make(Layer.empty);\nexport function start(): void {\n\truntime.runFork(Effect.void);\n}\n',
	],
	...(["FiberHandle", "FiberMap"] as const).map(
		(module) =>
			[
				`a runner from ${module}.makeRuntime`,
				`import { Effect, ${module} } from "effect";\nexport const starter = Effect.gen(function* () {\n\tconst run = yield* ${module}.makeRuntime<never>();\n\treturn run;\n});\n`,
			] as const,
	),
	[
		"a run-main factory",
		'import { Runtime } from "effect";\nexport const runMain = Runtime.makeRunMain(({ fiber }) => {\n\tfiber.currentDispatcher.flush();\n});\n',
	],
	["a Promise value", "const ready = Promise.withResolvers<void>();\nexport function release(): void {\n\tready.resolve();\n}\n"],
	[
		"a method of a value its outside library typed",
		'import type { IncomingMessage } from "outside-http";\ndeclare const request: IncomingMessage;\nexport function closeSignal(): AbortSignal {\n\tconst controller = new AbortController();\n\trequest.once("close", () => controller.abort());\n\treturn controller.signal;\n}\n',
	],
] as const) {
	ruleStory.it(
		`effect/adapter-bridges accepts an adapter that uses ${use}`,
		[
			effectResolves("@effect/platform-node"),
			repositoryHas(
				MANIFEST,
				...outsideLibrary("outside-http", 'export interface IncomingMessage { once(event: "close", listener: () => void): this; }\n'),
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
