import { Effect, Redacted, Schema } from "effect";
import type { Aead, SecureRandom } from "effect/crypto";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import type { ColumnKey, ColumnKeyError } from "#ColumnKey.ts";
import { encrypted } from "#encrypted.ts";
import { makeRepository } from "#repository.ts";
import type { RepositoryBuildError } from "#repositoryCollection.ts";

class Connection extends Model.Class<Connection>("TypedConnection")({
	id: Schema.Number,
	owner: Schema.String,
	token: encrypted(Schema.String),
}) {}

const program = Effect.gen(function* () {
	const connections = yield* makeRepository(Connection, { tableName: "connections" });
	const token = Redacted.make("token-a");

	const inserted = connections.insert({ id: 1, owner: "alice", token });
	expectTypeOf<Effect.Services<typeof inserted>>().toEqualTypeOf<ColumnKey | Aead.Aead | SecureRandom.SecureRandom>();
	expectTypeOf<Effect.Success<typeof inserted>["token"]>().toEqualTypeOf<Redacted.Redacted<string>>();
	expectTypeOf<Effect.Services<ReturnType<typeof connections.update>>>().toEqualTypeOf<ColumnKey | Aead.Aead | SecureRandom.SecureRandom>();
	expectTypeOf<Effect.Services<ReturnType<typeof connections.findById>>>().toEqualTypeOf<ColumnKey | Aead.Aead>();
	const owners = connections.findMany({ select: ["owner"], where: { owner: "alice" } });
	expectTypeOf<Effect.Services<typeof owners>>().toEqualTypeOf<never>();
	const tokens = connections.findMany({ select: ["token"] });
	expectTypeOf<Effect.Services<typeof tokens>>().toEqualTypeOf<ColumnKey | Aead.Aead>();

	// @ts-expect-error An encrypted field takes no equality filter: its sealed bytes differ on every write.
	connections.findMany({ where: { token } });
	// @ts-expect-error An encrypted field takes no in list.
	connections.count({ where: { token: { in: [token] } } });
	// @ts-expect-error A delete cannot filter by an encrypted field.
	connections.delete({ token });
	// @ts-expect-error A select statement cannot filter by an encrypted field.
	connections.select({ where: { token } });
	// @ts-expect-error A conflict predicate cannot name an encrypted field.
	yield* makeRepository(Connection, { conflictColumns: ["id"], conflictWhere: { token }, tableName: "connections" });
});

it("building a repository of an encrypted field loads the column key, its writes need the key, Aead and SecureRandom, its reads the key and Aead, and no filter names it", () => {
	expectTypeOf(program).toEqualTypeOf<Effect.Effect<void, RepositoryBuildError | ColumnKeyError, SqlClient.SqlClient | ColumnKey>>();
});
