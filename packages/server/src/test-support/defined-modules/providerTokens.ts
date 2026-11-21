import { Effect, Redacted, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { encrypted } from "@shivaedev/sql/encrypted.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { AppModule } from "#AppModule.ts";

class ProviderToken extends Model.Class<ProviderToken>("ProviderToken")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	token: encrypted(Schema.String),
}) {}

const ProviderTokens = defineRepository({
	id: "@shivaedev/server/test/ProviderTokens",
	initialize: makeRepository(ProviderToken, { tableName: "provider_tokens" }),
});

const Store = command("store", {
	invalidates: () => [],
	payload: { token: Schema.String },
	*run({ token }) {
		const tokens = yield* ProviderTokens;
		const saved = yield* Effect.orDie(tokens.insert({ token: Redacted.make(token) }));
		return saved.id;
	},
});

// Returns the opened token so a story can see the host's key open what it sealed; an application never sends it.
const Reveal = query("reveal", {
	payload: { id: Schema.Number },
	readPolicy: () => Effect.succeed(true),
	*run({ id }) {
		const stored = yield* Effect.orDie((yield* ProviderTokens).findById(id));
		return Redacted.value(stored.token);
	},
});

export const ProviderTokensModule = defineModule({
	middleware: MaybeAuthenticated,
	name: "providerTokens",
	operations: [Store, Reveal],
	wire: { reveal: { rejections: {}, success: Schema.String }, store: { rejections: {}, success: Schema.Number } },
});

export const providerTokensModule = {
	migrations: {
		loader: Migrator.fromRecord({
			"004_provider_tokens": SqlClient.SqlClient.use((sql) => sql`create table provider_tokens (id serial primary key, token bytea not null)`),
		}),
	},
	module: ProviderTokensModule,
	services: ProviderTokens.layer,
} satisfies AppModule;
