import type { ResourceNames } from "#resource/names.ts";

export function resourceRepository({ name, pascal, table }: ResourceNames) {
	return `import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { Item, keys } from "#modules/${name}/model.ts";

class StoredItem extends Model.Class<StoredItem>("Stored${pascal}Item")({
	...Model.fields(Item),
	userId: bucket(Schema.String),
}) {}

const make${pascal}Repository = makeRepository(StoredItem, {
	collection: keys,
	idColumn: "id",
	spanPrefix: "${pascal}",
	tableName: "${table}",
});

export const ${pascal}Repository = defineRepository({ id: "app/${pascal}Repository", initialize: make${pascal}Repository });
`;
}

export function resourceMigration({ table }: ResourceNames) {
	return `import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { userReference } from "@shivaedev/identity/server/better-auth/userReference.ts";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql\`create table \${sql("${table}")} (
		id serial primary key,
		title text not null,
		user_id text not null references \${sql(userReference.table)} (\${sql(userReference.column)}) on delete cascade
	)\`;
});
`;
}
