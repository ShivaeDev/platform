import { type Cause, Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import { makeRepository, type OptimisticConcurrencyError } from "#repository.ts";

class Prefix extends Context.Service<Prefix, string>()("versioned/Prefix") {}
const Name = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Document extends Model.Class<Document>("Document")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	lockVersion: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Name,
}) {}

class OwnedDocument extends Model.Class<OwnedDocument>("OwnedDocument")({
	id: Schema.NumberFromString,
	lockVersion: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Name,
	ownerId: Name,
}) {}

const program = Effect.gen(function* () {
	const options = { idColumn: "id", spanPrefix: "Document", tableName: "documents" } as const;
	const documents = yield* makeRepository(Document, { ...options, versionColumn: "lockVersion" });
	const input = { id: 1, lockVersion: 0, name: "draft" };
	expectTypeOf<Effect.Error<ReturnType<typeof documents.update>>>().toEqualTypeOf<SqlError | Schema.SchemaError | OptimisticConcurrencyError>();
	expectTypeOf<Effect.Success<ReturnType<typeof documents.update>>>().toEqualTypeOf<Document>();
	expectTypeOf<Effect.Services<ReturnType<typeof documents.update>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof documents.updateVoid>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof documents.insert>>>().toEqualTypeOf<Prefix>();
	expectTypeOf<Effect.Services<ReturnType<typeof documents.insertVoid>>>().toEqualTypeOf<Prefix>();
	documents.update(input);
	documents.delete(1, 0);
	// @ts-expect-error Versioned delete requires the version that was read.
	documents.delete(1);
	// @ts-expect-error Expected versions are numbers.
	documents.delete(1, "0");
	// @ts-expect-error Versioned update requires the version that was read.
	documents.update({ id: 1, name: "draft" });
	// @ts-expect-error Insert versions are initialized by the repository.
	documents.insert({ lockVersion: 5, name: "draft" });
	// @ts-expect-error The version column must be a generated numeric model field.
	makeRepository(Document, { ...options, versionColumn: "name" });
	// @ts-expect-error The primary key cannot be the version column.
	makeRepository(Document, { ...options, versionColumn: "id" });
	// @ts-expect-error Unknown columns are rejected.
	makeRepository(Document, { ...options, versionColumn: "missing" });
	const idempotent = yield* makeRepository(Document, { ...options, conflictColumns: ["name"], versionColumn: "lockVersion" });
	idempotent.insertOrIgnore({ name: "draft" });
	// @ts-expect-error Versioned conflict repositories do not expose unconditional upserts.
	idempotent.upsert({ name: "draft" }, { updateColumns: ["name"] });
	// @ts-expect-error Versioned conflict repositories do not expose batch upserts.
	idempotent.upsertMany([{ name: "draft" }], { updateColumns: ["name"] });
	// @ts-expect-error Versioned conflict repositories do not expose other conflict writes.
	idempotent.insertManyOrIgnore([{ name: "draft" }]);
	// @ts-expect-error Versioned repositories do not expose unconditional upserts.
	documents.upsert({ name: "draft" }, { updateColumns: ["name"] });
	// @ts-expect-error Versioned repositories do not expose unconditional batch writes.
	documents.insertMany([{ name: "draft" }]);
	// @ts-expect-error Batch conflicts cannot bypass optimistic concurrency.
	documents.insertManyOrIgnore([{ name: "draft" }]);
	// @ts-expect-error Batch upserts cannot bypass optimistic concurrency.
	documents.upsertMany([{ name: "draft" }], { updateColumns: ["name"] });
	const owned = yield* makeRepository(OwnedDocument, {
		conflictColumns: ["id"],
		idColumn: ["id", "ownerId"],
		spanPrefix: "Owned",
		tableName: "owned",
		versionColumn: "lockVersion",
	});
	owned.delete({ id: 1, ownerId: "owner" }, 0);
	owned.findById({ id: 1, ownerId: "owner" });
	owned.insertOrIgnore({ id: 1, name: "draft", ownerId: "owner" });
	expectTypeOf<Effect.Success<ReturnType<typeof owned.update>>>().toEqualTypeOf<OwnedDocument>();
	expectTypeOf<Effect.Services<ReturnType<typeof owned.delete>>>().toEqualTypeOf<Prefix>();
	// @ts-expect-error Composite versioned deletes require every key column.
	owned.delete({ id: 1 }, 0);
	// @ts-expect-error Composite versioned deletes take a key object.
	owned.delete(1, 0);
	// @ts-expect-error Composite versioned repositories cannot upsert without a version comparison.
	owned.upsert({ id: 1, name: "draft", ownerId: "owner" }, { updateColumns: ["name"] });
	// @ts-expect-error The version column cannot be any component of the primary key.
	makeRepository(OwnedDocument, { idColumn: ["id", "lockVersion"], spanPrefix: "Owned", tableName: "owned", versionColumn: "lockVersion" });
	const plain = yield* makeRepository(Document, options);
	plain.delete(1);
	// @ts-expect-error Unversioned delete retains its one-argument signature.
	plain.delete(1, 0);
	expectTypeOf<Effect.Error<ReturnType<typeof plain.update>>>().toEqualTypeOf<SqlError | Schema.SchemaError>();
	const missingResult = plain.update(input, { onMissing: "fail" });
	expectTypeOf<Effect.Error<typeof missingResult>>().toEqualTypeOf<SqlError | Schema.SchemaError | Cause.NoSuchElementError>();
	expectTypeOf<Effect.Success<typeof missingResult>>().toEqualTypeOf<Document>();
	expectTypeOf<Effect.Services<typeof missingResult>>().toEqualTypeOf<Prefix>();
	const composite = yield* makeRepository(OwnedDocument, { idColumn: ["id", "ownerId"], spanPrefix: "Owned", tableName: "owned" });
	const compositeResult = composite.update({ ...input, ownerId: "owner" }, { onMissing: "fail" });
	expectTypeOf<Effect.Error<typeof compositeResult>>().toEqualTypeOf<SqlError | Schema.SchemaError | Cause.NoSuchElementError>();
	expectTypeOf<Effect.Success<typeof compositeResult>>().toEqualTypeOf<OwnedDocument>();
	expectTypeOf<Effect.Services<typeof compositeResult>>().toEqualTypeOf<Prefix>();
	// @ts-expect-error Opt-in updates retain the full model update input.
	composite.update({ id: 1, name: "draft" }, { onMissing: "fail" });
	// @ts-expect-error Versioned updates retain their optimistic concurrency failure contract.
	owned.update({ ...input, ownerId: "owner" }, { onMissing: "fail" });
});

it("repository type contracts compile", () => {
	expectTypeOf(program).toBeObject();
});
