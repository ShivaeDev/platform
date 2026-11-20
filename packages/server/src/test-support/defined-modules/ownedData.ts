import { Effect, Layer, Schema } from "effect";
import { Model } from "effect/schema";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { owner } from "@shivaedev/sql/owner.ts";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { AppModule } from "#AppModule.ts";

class Notebook extends Model.Class<Notebook>("Notebook")({
	id: Schema.Number,
	ownerId: owner(Schema.String),
	title: Schema.String,
}) {}

class Reminder extends Model.Class<Reminder>("Reminder")({
	id: Schema.Number,
	userId: owner(Schema.NullOr(Schema.String)),
}) {}

class Topic extends Model.Class<Topic>("Topic")({
	id: Schema.Number,
	name: Schema.String,
}) {}

const Notebooks = defineRepository({
	id: "@shivaedev/server/test/Notebooks",
	initialize: makeRepository(Notebook, { tableName: "notebooks" }),
});

const Reminders = defineRepository({
	id: "@shivaedev/server/test/Reminders",
	initialize: makeRepository(Reminder, { tableName: "reminders" }),
});

const Topics = defineRepository({
	id: "@shivaedev/server/test/Topics",
	initialize: makeRepository(Topic, { tableName: "topics" }),
});

// Reports what a reader of the host's owned models sees from inside a served operation, where identity reads them.
const Owned = query("owned", {
	payload: {},
	readPolicy: () => Effect.succeed(true),
	*run() {
		const owned = yield* (yield* RepositoryModels).owned;
		return owned.map(({ owner: { column }, table }) => ({ column, table }));
	},
});

export const OwnedData = defineModule({
	middleware: MaybeAuthenticated,
	name: "ownedData",
	operations: [Owned],
	wire: { owned: { rejections: {}, success: Schema.Array(Schema.Struct({ column: Schema.String, table: Schema.String })) } },
});

export const ownedDataModule = {
	module: OwnedData,
	services: Layer.mergeAll(Notebooks.layer, Reminders.layer, Topics.layer),
} satisfies AppModule;
