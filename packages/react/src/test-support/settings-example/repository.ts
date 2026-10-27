import { Context, Effect, Layer, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { EntitySettings } from "./contract.ts";

class Entity extends Model.Class<Entity>("Entity")({
	id: Schema.Number,
	ownerId: Schema.String,
}) {}
class SettingsRow extends Model.Class<SettingsRow>("SettingsRow")(EntitySettings.fields) {}
const entities = makeRepository(Entity, {
	idColumn: "id",
	spanPrefix: "Entities",
	tableName: "entities",
});
const settings = makeRepository(SettingsRow, {
	conflictColumns: ["entityId"],
	idColumn: "entityId",
	spanPrefix: "Settings",
	tableName: "entity_settings",
});
export class EntitiesRepository extends Context.Service<EntitiesRepository, Effect.Success<typeof entities>>()("settings-example/Entities") {}
export class SettingsRepository extends Context.Service<SettingsRepository, Effect.Success<typeof settings>>()("settings-example/Settings") {}
export const repositories = Layer.merge(Layer.effect(EntitiesRepository, entities), Layer.effect(SettingsRepository, settings));
export const migrations = {
	loader: Migrator.fromRecord({
		"001_entity_settings": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table entities (id integer primary key, "ownerId" text not null)`;
			yield* sql`create table entity_settings ("entityId" integer primary key references entities(id), title text not null, "pageSize" integer not null)`;
		}),
	}),
};
