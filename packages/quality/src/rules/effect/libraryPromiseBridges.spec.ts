import { effectBoundary } from "#rules/effect/boundary.ts";
import { usesAt } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { assertThat } from "#testing/assertThat.ts";

const BRIDGES = [
	'import { Effect } from "effect";',
	'import { client, get } from "remote-client";',
	'import * as Remote from "@remote/sdk/http";',
	'import { sql } from "remote-sql";',
	"export const load = (id: string) => Effect.tryPromise({ try: () => get(id), catch: (cause) => cause });",
	"export const lookup = (id: string) => Effect.promise(() => client.load(id));",
	"export const send = Effect.tryPromise(Remote.send);",
	"export const rows = Effect.tryPromise(() => sql`select 1`);",
].join("\n");

ruleStory.it(
	"effect/boundary reports Effect.tryPromise and Effect.promise bridges to an imported outside library in core code",
	[repositoryHas({ content: BRIDGES, path: "src/work.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) =>
			actual.toEqual([
				usesAt("src/work.ts", 5, "Promise bridge to the library remote-client"),
				usesAt("src/work.ts", 6, "Promise bridge to the library remote-client"),
				usesAt("src/work.ts", 7, "Promise bridge to the library @remote/sdk/http"),
				usesAt("src/work.ts", 8, "Promise bridge to the library remote-sql"),
			]),
		);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts the same library bridges under adapters/",
	[repositoryHas({ content: BRIDGES, path: "src/adapters/work.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts plain-value library calls and bridges to a Promise typed by the repository's own interface, to workspace code or to dynamic imports in core code",
	[
		repositoryHas(
			{ content: "export const later = (id: string) => Promise.resolve(id);", path: "src/adapters/later.ts" },
			{
				content: [
					'import { Effect } from "effect";',
					'import { label } from "remote-client";',
					'import { later } from "./adapters/later.ts";',
					"interface Queue { create(name: string): Promise<void> }",
					"export const title = (id: string) => Effect.succeed(label(id));",
					'export const create = (queue: Queue) => Effect.tryPromise(() => queue.create("jobs"));',
					"export const wait = (id: string) => Effect.promise(() => later(id));",
					'export const loaded = Effect.promise(() => import("remote-client"));',
					'export const own = Effect.promise(() => import("./adapters/later.ts"));',
				].join("\n"),
				path: "src/work.ts",
			},
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/boundary accepts a bridge in core code over a binding imported from an installed @shivaedev package",
	[
		repositoryHas(
			{ content: '{"dependencies":{"@shivaedev/test-story":"*"}}', path: "package.json" },
			{ content: '{"name":"@shivaedev/test-story","types":"visit.d.ts"}', path: "node_modules/@shivaedev/test-story/package.json" },
			{ content: "export declare function visit(url: string): Promise<string>;", path: "node_modules/@shivaedev/test-story/visit.d.ts" },
			{
				content:
					'import { Effect } from "effect";\nimport { visit } from "@shivaedev/test-story/visit.ts";\nexport const page = Effect.tryPromise(() => visit("/"));',
				path: "src/work.ts",
			},
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(effectBoundary), (actual) => actual.toEqual([]));
	},
	CLI_TIMEOUT,
);
