import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { expectTypeOf, it } from "vitest";
import type { UpsertResult } from "#conditionalUpsert.ts";
import { makeRepository } from "#repository.ts";
import { PullRequest, pull, syncOptions } from "#test/pullRequests.ts";

class Prefix extends Context.Service<Prefix, string>()("conditional/Prefix") {}
const Title = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform((value: string) => value),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class EncodedPull extends Model.Class<EncodedPull>("EncodedPull")({
	id: Schema.Int,
	title: Model.Field({ insert: Schema.String, select: Title, update: Schema.String }),
}) {}
const program = Effect.gen(function* () {
	const options = { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Pull", tableName: "pulls" } as const;
	const rows = yield* makeRepository(PullRequest, options);
	const saved = rows.upsert(pull(12), syncOptions);
	const many = rows.upsertMany([pull(12)], syncOptions);
	expectTypeOf<Effect.Success<typeof saved>>().toEqualTypeOf<UpsertResult<PullRequest>>();
	expectTypeOf<Effect.Success<typeof many>>().toEqualTypeOf<UpsertResult<PullRequest>[]>();
	expectTypeOf<Effect.Services<typeof saved>>().toEqualTypeOf<never>();
	// @ts-expect-error Incoming references must name model fields.
	rows.upsert(pull(12), { updateColumns: ["title"], updateWhere: { "updated_at": { lt: { excluded: "missing" } } } });
	// @ts-expect-error Incoming references must have the compared column's type.
	rows.upsert(pull(12), { updateColumns: ["title"], updateWhere: { "updated_at": { lt: { excluded: "title" } } } });
	// @ts-expect-error Timestamp literals use the decoded UTC type.
	rows.upsertMany([pull(12)], { updateColumns: ["title"], updateWhere: { "updated_at": { lt: "2026-10-25" } } });
	// @ts-expect-error Conditions must name model fields.
	rows.upsert(pull(12), { updateColumns: ["title"], updateWhere: { missing: 1 } });
	const encoded = yield* makeRepository(EncodedPull, options);
	const written = encoded.upsert({ id: 1, title: "New" }, { updateColumns: ["title"], updateWhere: { title: "Old" } });
	expectTypeOf<Effect.Services<typeof written>>().toEqualTypeOf<Prefix>();
});
it("conditional upserts type incoming columns, decoded literals, outcomes and codec services", () => {
	expectTypeOf(program).toExtend<Effect.Effect<void, never, unknown>>();
});
