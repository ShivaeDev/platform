import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { rename } from "./rename.ts";

export const Items = defineService({
	id: "@shivaedev/test-sql/test/Items",
	initialize: Effect.void,
	methods: () => ({ rename }),
	requires: [SqlClient.SqlClient],
});
