import { Effect, Schema } from "effect";
import { Model as NativeModel } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clientOptions, type SqlNameTransforms } from "#clientOptions.ts";
import { Model } from "#Model.ts";
import { postgresLayer } from "#postgresLayer.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "./engines.ts";
import { attempt } from "./outcome.ts";
import { postgresOptions } from "./postgres.ts";
import { ownTable, recording, statementKinds, statementLog, uniqueTable } from "./writeTables.ts";

export class Food extends NativeModel.Class<Food>("GroupedFood")({
	energy: Model.Group({ expected: Schema.NumberFromString, high: Schema.NumberFromString, low: Schema.NumberFromString }, { prefix: "energy_" }),
	id: NativeModel.Field({ select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	source: NativeModel.Field({ insert: Schema.String }),
	version: NativeModel.Field({ select: Schema.Number, update: Schema.Number }),
}) {}

export const firstFood = { energy: { expected: 20, high: 30, low: 10 }, name: "Oats" };

const insertion = { ...firstFood, source: "nutrition label" };

const foodEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("grouped_foods");
	yield* ownTable(
		sql,
		tableName,
		sql`id integer generated always as identity primary key, name text not null, source text not null,
		energy_low text not null, energy_expected text not null, energy_high text not null, version integer not null default 0`,
	);
	const options = { idColumn: "id", spanPrefix: "Food", tableName } as const;
	return {
		foods: yield* makeRepository(Food, { ...options, versionColumn: "version" }),
		log: statementLog(),
		plain: yield* makeRepository(Food, options),
		sql,
		tableName,
	};
});

function foodKit(name: string, options: SqlNameTransforms = {}) {
	return storyKit({
		...onPostgres,
		create: foodEngine,
		layer: postgresLayer(postgresOptions.url, { ...postgresOptions, ...options }),
		name,
		stages: ["rows"],
		verbs: ({ foods, plain, sql, tableName, log }, story) => ({
			food: () => foods.findById(1),
			insert: () => {
				story.tell("insert oats with a grouped energy triple");
				return foods.insert(insertion);
			},
			insertPlain: () => {
				story.tell("insert oats through an unversioned repository");
				return plain.insert(insertion);
			},
			listEnergy: () => foods.findMany({ select: ["energy"] }),
			rawColumns: () => sql`select energy_low, energy_expected, energy_high, source from ${sql(tableName)} where id = 1`.withoutTransform,
			rename: (version: number, write: "update" | "updateVoid" = "update") => {
				story.tell(`rename oats at version ${version}, choosing only name`);
				return attempt(
					recording(
						log,
						write === "update"
							? foods.update({ id: 1, name: "Porridge", version }, { columns: ["name"] })
							: foods.updateVoid({ id: 1, name: "Porridge", version }, { columns: ["name"] }),
					),
				);
			},
			replaceEnergy: () => {
				story.tell("replace only the grouped energy triple");
				return foods.update({ energy: { expected: 21, high: 31, low: 11 }, id: 1, version: 0 }, { columns: ["energy"] });
			},
			statementKinds: () => statementKinds(log),
		}),
	});
}
export const groupedFoods = foodKit("grouped food columns");
export const snakeCaseGroupedFoods = foodKit("grouped food columns with snake_case names", clientOptions({}));

export function oatsStored() {
	return groupedFoods.trait("rows", "oats are stored at version zero", ({ foods }) => foods.insertVoid(insertion));
}
