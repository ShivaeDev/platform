import type { SeedFile } from "@shivaedev/test-kits/quality/adapters/tree.ts";

export function transactionConsumer(code: string, path = "src/consumer.ts"): SeedFile {
	return {
		content: [
			'import { Effect, Schema, pipe } from "effect";',
			'import { Model } from "effect/schema";',
			'import { SqlClient } from "effect/sql";',
			'import { makeRepository } from "@shivaedev/sql/repository.ts";',
			'import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";',
			'class Note extends Model.Class<Note>("Note")({ id: Schema.Number, name: Schema.String }) {}',
			'export const write = Effect.gen(function* () { const sql = yield* SqlClient.SqlClient; const notes = yield* makeRepository(Note, { idColumn: "id", spanPrefix: "Notes", tableName: "notes" });',
			code,
			"});",
		].join("\n"),
		path,
	};
}
