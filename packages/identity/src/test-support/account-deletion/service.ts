import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { HandOverPlan } from "#test/account-deletion/HandOverPlan.ts";
import { handOver } from "#test/account-deletion/handOver.ts";

export const ProjectHandOver = defineService({
	id: "@shivaedev/identity/test/ProjectHandOver",
	initialize: Effect.void,
	methods: () => ({ handOver }),
	requires: [HandOverPlan, SqlClient.SqlClient],
});
