import { createRequire } from "node:module";
import { dirname } from "node:path";
import { makeRuleStory } from "@shivaedev/quality/testing/ruleStory.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { changeFeed } from "#test/changeFeed.ts";

const quality = makeRuleStory();

export const repositoryTransactions = storyKit({
	extends: [changeFeed, quality],
	name: "PostgreSQL repository transaction guidance",
});

export function consumerPackages() {
	return repositoryTransactions.traits(
		...["effect", "@shivaedev/sql"].map((name) =>
			quality.repositoryLinks(`node_modules/${name}`, dirname(createRequire(import.meta.url).resolve(`${name}/package.json`))),
		),
	);
}

export function consumerTransaction(owner: "native" | "transact") {
	const body = "Effect.gen(function* () { yield* rows.insert({ id: 1 }); yield* rows.insert({ id: 2 }); })";
	return {
		content: [
			'import { Effect, Schema } from "effect";',
			'import { Model } from "effect/schema";',
			'import { SqlClient } from "effect/sql";',
			'import { makeRepository } from "@shivaedev/sql/repository.ts";',
			'import { transact } from "@shivaedev/sql/transact.ts";',
			'class Row extends Model.Class<Row>("Row")({ id: Schema.Number }) {}',
			'export const save = Effect.gen(function* () { const sql = yield* SqlClient.SqlClient; const rows = yield* makeRepository(Row, { idColumn: "id", spanPrefix: "Rows", tableName: "rows" });',
			owner === "native" ? `yield* sql.withTransaction(${body});` : `yield* transact(${body});`,
			"});",
		].join("\n"),
		path: "src/save.ts",
	};
}

export const consumerHas = quality.repositoryHas;
