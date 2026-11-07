import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { rename } from "#test/items/rename.ts";

export const Items = defineService({
	id: "@shivaedev/test-sql/test/Items",
	initialize: Effect.void,
	methods: () => ({ rename }),
	requires: [SqlClient.SqlClient],
});
