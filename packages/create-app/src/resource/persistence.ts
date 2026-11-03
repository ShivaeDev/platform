import type { ResourceNames } from "./names.ts";

export function resourceRepository({ name, pascal, table }: ResourceNames) {
	return `import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { Item, keys } from "#modules/${name}/${name}.ts";

export class StoredItem extends Model.Class<StoredItem>("Stored${pascal}Item")({
	...Model.fields(Item),
	userId: bucket(Schema.String),
}) {}

export const make${pascal}Repository = makeRepository(StoredItem, {
	collection: keys,
	idColumn: "id",
	spanPrefix: "${pascal}",
	tableName: "${table}",
});
`;
}

export function resourceService({ name, pascal }: ResourceNames) {
	return `import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import type { Create } from "#modules/${name}/${name}.ts";
import { make${pascal}Repository } from "./makeRepository.ts";

const unavailable = (cause: SqlError) => Object.assign(new ServiceUnavailable({ message: "Could not reach the ${name} database" }), { cause });

export const ${pascal}Service = defineService({
	id: "app/${pascal}Service",
	initialize: make${pascal}Repository,
	methods: (repository) => ({
		create: (input: typeof Create.payload.Type, userId: string) =>
			repository.insert({ ...input, userId }).pipe(transact({ onSqlError: unavailable })),
		list: (userId: string) =>
			repository
				.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title"], where: { userId } })
				.pipe(Effect.catchTag("SqlError", (cause) => Effect.fail(unavailable(cause)))),
	}),
	requires: [SqlClient.SqlClient, Reactivity.Reactivity],
});
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
