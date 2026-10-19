import * as PgClient from "@effect/sql-pg/PgClient";
import { Data, Effect, Option } from "effect";
import type { Model } from "effect/schema";
import { modelColumnProblems } from "#internal/modelColumnProblems.ts";
import type { PostgresColumn } from "./migrationUpgrade.ts";

export class ModelColumnMismatch extends Data.TaggedError("ModelColumnMismatch")<{
	readonly problems: readonly string[];
}> {}

export const assertModelColumns = Effect.fn("PostgresTest.assertModelColumns")(function* <TModel extends Model.Any>(
	columns: readonly PostgresColumn[],
	model: TModel,
	types: { readonly [TField in keyof NoInfer<TModel>["fields"]]: string },
) {
	const client = yield* Effect.serviceOption(PgClient.PgClient);
	const problems = modelColumnProblems(columns, model.fields, types, Option.getOrUndefined(client)?.config);
	return yield* problems.length === 0 ? Effect.void : Effect.fail(new ModelColumnMismatch({ problems }));
});
