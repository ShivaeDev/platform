import { expect } from "@effect/vitest";
import { engineBody, engineBodyFiles } from "#test/engineBodyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles } from "#testing/adapters/storySpecFiles.ts";
import { storyEngine } from "./engine.ts";

for (const [code, reason] of [
	["const raw = yield* Orders; yield* raw.save();", "Reads a raw service handle"],
	["const raw = yield* runtime.Orders; yield* raw.save();", "Reads a raw service handle"],
	["const raw = yield* (Orders); yield* raw.save();", "Reads a raw service handle"],
	["const raw = yield* Store; yield* raw.save();", "Reads a raw service handle"],
	["const raw = yield* Tasks; yield* raw.save();", "Reads a raw service handle"],
	["const Tag = Orders; const raw = yield* Tag; yield* raw.save();", "Reads a raw service handle"],
	["yield* Effect.flatMap(Orders, (raw) => raw.save());", "Reads a raw service handle"],
	["yield* save(); yield* Effect.gen(function* () { const raw = yield* Orders; yield* raw.save(); });", "Reads a raw service handle"],
	["const raw = yield* SqlClient.SqlClient; yield* raw`select 1`;", "Reads a raw service handle"],
	["yield* SqlClient.SqlClient.pipe(Effect.flatMap((raw) => raw`select 1`));", "Reads a raw service handle"],
	["yield* story.engine.save();", "Reads story.engine"],
	["yield* (story).engine.save();", "Reads story.engine"],
	['yield* story["engine"].save();', "Reads story.engine"],
	["const told = story; yield* told.engine.save();", "Reads story.engine"],
	["const { engine: raw } = story; yield* raw.save();", "Reads story.engine"],
	["yield* makeOrders();", "Calls a production constructor"],
	["yield* runtime.makeOrders();", "Calls a production constructor"],
	["yield* createStore();", "Calls a production constructor"],
	["const construct = makeOrders; yield* construct();", "Calls a production constructor"],
	["const client = new Client();", "Calls a production constructor"],
] as const) {
	ruleStory.it(
		`tests/story-engine reports a kit escape even with traits: ${code}`,
		[repositoryHas(...kitFiles, ...engineBodyFiles, engineBody(code))],
		function* ({ check }) {
			const findings = yield* check(storyEngine);

			expect(findings).toEqual([
				{
					file: "src/orders.spec.ts",
					line: 7,
					message: expect.stringContaining(
						`${reason} in a spec body. Move engine access and wiring into the story kit's verbs or traits in test-support/. Keep expectations in the spec.`,
					),
				},
			]);
		},
	);
}

for (const [code, parameters] of [
	["yield* told.story.engine.save();", "told"],
	["yield* raw.save();", "{ story: { engine: raw } }"],
] as const) {
	ruleStory.it(
		`tests/story-engine follows engine access through its body parameters: ${parameters}`,
		[repositoryHas(...kitFiles, engineBody(code, parameters, "[]"))],
		function* ({ check }) {
			expect(yield* check(storyEngine)).toEqual([
				expect.objectContaining({ file: "src/orders.spec.ts", line: 7, message: expect.stringContaining("Reads story.engine") }),
			]);
		},
	);
}

for (const code of [
	"yield* save();",
	"yield* save(new Draft({}));",
	"yield* save(Orders);",
	"const implementation = Orders.of({ save }); yield* save(implementation);",
	'const state = yield* Ref.make("draft"); yield* save(yield* Ref.get(state));',
	'const value = Schema.Struct({ title: Schema.String }).make({ title: "draft" }); yield* save(value);',
	"const unrelated = { engine: { save } }; yield* unrelated.engine.save();",
	'function read(story) { return story.engine; } yield* save(read({ engine: "draft" }));',
	"const sql = yield* SqlClient.SqlClient; yield* sql.withTransaction(save());",
	"const sql = yield* SqlClient.SqlClient; yield* save().pipe(sql.withTransaction);",
] as const) {
	ruleStory.it(
		`tests/story-engine accepts kit verbs, native data and transaction blocks: ${code}`,
		[repositoryHas(...kitFiles, ...engineBodyFiles, engineBody(code, "{ save }", "[]"))],
		function* ({ check }) {
			expect(yield* check(storyEngine)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/story-engine accepts the constructor as the subject in its colocated spec without other kit inputs",
	[repositoryHas(...kitFiles, ...engineBodyFiles, engineBody("expect(makeOrders()).toEqual({});", "", "[]", "src/runtime.spec.ts"))],
	function* ({ check }) {
		expect(yield* check(storyEngine)).toEqual([]);
	},
);

for (const [code, reason] of [
	["const sql = yield* SqlClient.SqlClient; yield* sql.withTransaction(save());", undefined],
	["const sql = yield* SqlClient.SqlClient; yield* sql`select 1`;", "Reads a raw service handle"],
] as const) {
	const file = engineBody(code, "{ save }", "[]");
	ruleStory.it(
		`tests/story-engine distinguishes transaction wrappers from raw SQL through effect/sql: ${code}`,
		[
			repositoryHas(...kitFiles, {
				...file,
				content: file.content.replace('import * as SqlClient from "effect/sql/SqlClient";', 'import { SqlClient } from "effect/sql";'),
			}),
		],
		function* ({ check }) {
			const findings = yield* check(storyEngine);

			expect(findings).toEqual(
				reason === undefined ? [] : [expect.objectContaining({ file: file.path, line: 7, message: expect.stringContaining(reason) })],
			);
		},
	);
}
