import { ConfigProvider, Effect, Layer, Redacted, Schema } from "effect";
import { Aead, SecureRandom } from "effect/crypto";
import * as Base64 from "effect/encoding/Base64";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { COLUMN_KEY_CONFIG, ColumnKey } from "#ColumnKey.ts";
import { encrypted } from "#encrypted.ts";
import { makeRepository } from "#repository.ts";
import type { RepositoryBuildError } from "#repositoryCollection.ts";
import { onPostgres } from "#test/engines.ts";
import { ownTable, uniqueTable } from "#test/writeTables.ts";

export class Connection extends Model.Class<Connection>("Connection")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	owner: Schema.String,
	token: encrypted(Schema.String),
}) {}

const tokenAsBucket = Model.Field({
	...encrypted(Schema.String).schemas,
	select: encrypted(Schema.String).schemas.select.annotate({ "@shivaedev/changes/bucket": true }),
});

class BucketedConnection extends Model.Class<BucketedConnection>("BucketedConnection")({
	id: Schema.Number,
	owner: Schema.String,
	token: tokenAsBucket,
}) {}

export type EncryptedRole = "a bucket" | "a conflict column" | "a tuple bucket column" | "the ID column";

const refusals: Record<EncryptedRole, () => Effect.Effect<unknown, RepositoryBuildError, SqlClient.SqlClient>> = {
	"a bucket": () => makeRepository(BucketedConnection, { collection: collection("refused_connections", Schema.Number, { token: Schema.String }) }),
	"a conflict column": () => makeRepository(Connection, { conflictColumns: ["token"], tableName: "refused_connections" }),
	"a tuple bucket column": () =>
		makeRepository(Connection, { collection: collection("refused_connections", Schema.Number, {}, { ownerToken: ["owner", "token"] }) }),
	"the ID column": () => makeRepository(Connection, { idColumn: "token", tableName: "refused_connections" }),
};

export type ConfiguredKey = "32 random bytes in base64" | "16 random bytes in base64" | "text that is not base64" | "nothing";

const cryptoServices = Aead.layerWebCrypto.pipe(Layer.provideMerge(SecureRandom.layerWebCrypto));

// What a handler holding the field sees: the value opened through Redacted, and how the value prints.
function shown(value: unknown) {
	return Redacted.isRedacted(value) ? { opened: Redacted.value(value), printed: String(value) } : { plain: value };
}

const generatedKey = Effect.gen(function* () {
	return yield* (yield* Aead.Aead).generateKey(Aead.xchacha20Poly1305);
});

const configText = Effect.fnUntraced(function* (configured: ConfiguredKey) {
	const random = yield* SecureRandom.SecureRandom;
	switch (configured) {
		case "32 random bytes in base64":
			return Base64.encode(yield* random.randomBytes(32));
		case "16 random bytes in base64":
			return Base64.encode(yield* random.randomBytes(16));
		case "text that is not base64":
			return `${Base64.encode(yield* random.randomBytes(32))}!`;
		case "nothing":
			return undefined;
	}
});

interface ConnectionEngine {
	columnKey: ColumnKey["Service"];
	configured: string | undefined;
	readonly connections: Effect.Success<ReturnType<typeof connectionRepository>>;
	readonly ids: Map<string, number>;
	readonly sql: SqlClient.SqlClient;
	readonly table: string;
}

function connectionRepository(table: string) {
	return makeRepository(Connection, { idColumn: "id", spanPrefix: "Connection", tableName: table });
}

const connectionEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("encrypted_connections");
	yield* ownTable(sql, table, sql`id integer generated always as identity primary key, owner text not null, token bytea not null`);
	const key = yield* generatedKey;
	const engine: ConnectionEngine = {
		columnKey: Effect.succeed(key),
		configured: undefined,
		connections: yield* connectionRepository(table),
		ids: new Map(),
		sql,
		table,
	};
	return engine;
});

function withKey<A, E, R>(engine: ConnectionEngine, effect: Effect.Effect<A, E, R>) {
	return Effect.provideService(effect, ColumnKey, engine.columnKey);
}

// A failure reads as its tag and message, which is what an application's log shows of it.
function outcome<A, E extends { readonly _tag: string; readonly message: string }, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.catch(effect, (error) => Effect.succeed(`${error._tag}: ${error.message}`));
}

function idOf(engine: ConnectionEngine, owner: string) {
	const id = engine.ids.get(owner);
	return id === undefined ? Effect.die(new Error(`Connect ${owner} first`)) : Effect.succeed(id);
}

function connect(engine: ConnectionEngine, owner: string, token: string) {
	return Effect.map(withKey(engine, engine.connections.insert({ owner, token: Redacted.make(token) })), (saved) => {
		engine.ids.set(owner, saved.id);
		return "connected";
	});
}

export const encryptedTokens = storyKit({
	...onPostgres,
	create: connectionEngine,
	layer: Layer.merge(onPostgres.layer, cryptoServices),
	name: "PostgreSQL encrypted provider tokens",
	stages: ["key", "connections"],
	verbs: (engine, story) => {
		const { connections, sql, table } = engine;
		return {
			configuredValue: () => Effect.sync(() => engine.configured ?? "nothing"),
			connect: (owner: string, token: string) =>
				Effect.suspend(() => {
					story.tell(`${owner} connects a provider whose token is ${token}`);
					return outcome(connect(engine, owner, token));
				}),
			encodedRead: (owner: string) =>
				Effect.suspend(() => {
					story.tell(`${owner}'s connection as read is encoded with the model's select schema, as a response would be`);
					return outcome(
						Effect.gen(function* () {
							const row = yield* withKey(engine, connections.findById(yield* idOf(engine, owner)));
							yield* Schema.encodeEffect(Connection)(row);
							return "encoded";
						}),
					);
				}),
			keyReplaced: () =>
				Effect.gen(function* () {
					story.tell("the application restarts with another generated column key");
					const key = yield* generatedKey;
					engine.columnKey = Effect.succeed(key);
				}),
			register: (role: EncryptedRole) =>
				Effect.suspend(() => {
					story.tell(`a repository is built with the encrypted token as ${role}`);
					return refusals[role]().pipe(Effect.match({ onFailure: (error) => `${error._tag}: ${error.message}`, onSuccess: () => "built" }));
				}),
			storedToken: (owner: string) =>
				Effect.gen(function* () {
					const rows = yield* sql<{ readonly token: Uint8Array; readonly type: string }>`
						select token, pg_typeof(token)::text as type from ${sql(table)} where owner = ${owner}`;
					const [row] = rows;
					if (row === undefined) {
						return yield* Effect.die(new Error(`No stored connection for ${owner}`));
					}
					return {
						asText: new TextDecoder().decode(row.token),
						base64: Base64.encode(row.token),
						bytes: row.token.length,
						type: row.type,
						version: row.token[0],
					};
				}),
			token: (owner: string) =>
				Effect.suspend(() => {
					story.tell(`${owner}'s connection is read back`);
					return outcome(
						Effect.gen(function* () {
							const row = yield* withKey(engine, connections.findById(yield* idOf(engine, owner)));
							return shown(row.token);
						}),
					);
				}),
		};
	},
});

export function keyConfigured(configured: ConfiguredKey) {
	return encryptedTokens.trait("key", `COLUMN_ENCRYPTION_KEY holds ${configured}`, (engine) =>
		Effect.gen(function* () {
			const text = yield* configText(configured);
			engine.configured = text;
			const provider = ConfigProvider.fromUnknown(text === undefined ? {} : { [COLUMN_KEY_CONFIG]: text });
			const built = yield* Layer.build(ColumnKey.fromConfig.pipe(Layer.provide(ConfigProvider.layer(provider))));
			engine.columnKey = yield* ColumnKey.pipe(Effect.provideContext(built));
		}),
	);
}

export function connected(tokens: Readonly<Record<string, string>>) {
	const listed = Object.entries(tokens).map(([owner, token]) => `${owner} (${token})`);
	return encryptedTokens.trait("connections", `the repository holds connections for ${listed.join(", ")}`, (engine) =>
		Effect.forEach(Object.entries(tokens), ([owner, token]) => connect(engine, owner, token), { discard: true }),
	);
}
