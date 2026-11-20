import { effectBoundary } from "#rules/effect/boundary.ts";
import { effectResolves, usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { assertThat } from "#testing/assertThat.ts";

const LIBRARY = [
	{ content: '{"name":"remote","types":"index.d.ts"}', path: "node_modules/remote/package.json" },
	{
		content: [
			"export declare function get(id: string): Promise<string>;",
			"export declare function label(id: string): string;",
			"export declare const cache: { peek(id: string): PromiseLike<string> | undefined };",
			"export interface Client { load(id: string): Promise<string> }",
		].join("\n"),
		path: "node_modules/remote/index.d.ts",
	},
];

const CALLS = [
	'import { Effect } from "effect";',
	'import { cache, type Client, get } from "remote";',
	"export const load = (id: string) => get(id);",
	"export const peek = (id: string) => Effect.sync(() => cache.peek(id));",
	"export const lookup = (client: Client, id: string) => Effect.tryPromise(() => client.load(id));",
].join("\n");

ruleStory.it(
	"effect/boundary reports a returned library Promise, a PromiseLike union and a received client's method inside Effect.tryPromise in core code",
	[repositoryHas(...LIBRARY, { content: CALLS, path: "src/work.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) =>
			actual.toEqual([
				usesAt("src/work.ts", 3, "get(...), a library call that returns a Promise"),
				usesAt("src/work.ts", 4, "cache.peek(...), a library call that returns a Promise"),
				usesAt("src/work.ts", 5, "client.load(...), a library call that returns a Promise"),
			]),
		);
	},
	CLI_TIMEOUT,
);

const SDK = [
	{ content: '{"name":"sdk","types":"index.d.ts"}', path: "node_modules/sdk/package.json" },
	{
		content: [
			"export declare class APIPromise<T> extends Promise<T> { withResponse(): Promise<{ data: T }> }",
			"export declare const api: {",
			"\tlist(): APIPromise<string[]>;",
			"\tfind(id: string): { readonly id: string } & Promise<string>;",
			"};",
		].join("\n"),
		path: "node_modules/sdk/index.d.ts",
	},
	{
		content: 'import { api } from "sdk";\nexport const list = () => api.list();\nexport const find = (id: string) => api.find(id);',
		path: "src/work.ts",
	},
];

ruleStory.it(
	"effect/boundary reports a library call that returns a Promise subclass or an intersection with a Promise in core code",
	[repositoryHas(...SDK)],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) =>
			actual.toEqual([
				usesAt("src/work.ts", 2, "api.list(...), a library call that returns a Promise"),
				usesAt("src/work.ts", 3, "api.find(...), a library call that returns a Promise"),
			]),
		);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary gives one finding for a library Promise that a bridge or an await already shows",
	[
		repositoryHas(...LIBRARY, {
			content: [
				'import { Effect } from "effect";',
				'import { get } from "remote";',
				"export const load = (id: string) => Effect.tryPromise(() => get(id));",
				"export async function read(id: string) {",
				"\treturn await get(id);",
				"}",
			].join("\n"),
			path: "src/work.ts",
		}),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) =>
			actual.toEqual([
				usesAt("src/work.ts", 3, "Promise bridge to the library remote"),
				usesAt("src/work.ts", 4, "async function"),
				usesAt("src/work.ts", 5, "await"),
			]),
		);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts library calls that return a Promise under adapters/",
	[repositoryHas(...LIBRARY, { content: CALLS, path: "src/adapters/work.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts a library call that returns a plain value in core code",
	[
		repositoryHas(...LIBRARY, {
			content: 'import { Effect } from "effect";\nimport { label } from "remote";\nexport const title = (id: string) => Effect.succeed(label(id));',
			path: "src/work.ts",
		}),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts Promises from host globals, TypeScript's default library, installed @shivaedev packages and test files in core code",
	[
		repositoryHas(
			...LIBRARY,
			{ content: "export {};\ndeclare global {\n\tfunction ping(): Promise<void>;\n}", path: "node_modules/remote/global.d.ts" },
			{ content: '{"name":"@shivaedev/test-story","types":"visit.d.ts"}', path: "node_modules/@shivaedev/test-story/package.json" },
			{ content: "export declare function visit(url: string): Promise<string>;", path: "node_modules/@shivaedev/test-story/visit.d.ts" },
			{
				content: [
					'import "remote/global.d.ts";',
					'import { visit } from "@shivaedev/test-story/visit.ts";',
					"export const signal = () => ping();",
					"export const later = (id: string) => Promise.resolve(id);",
					'export const page = () => visit("/");',
				].join("\n"),
				path: "src/work.ts",
			},
			{ content: 'import { get } from "remote";\nexport const load = (id: string) => get(id);', path: "src/work.test.ts" },
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts Effect.runPromise at an entry point when Effect's declarations resolve",
	[
		effectResolves(),
		repositoryHas({ content: 'import { Effect } from "effect";\nexport const result = Effect.runPromise(Effect.void);', path: "src/main.ts" }),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);
