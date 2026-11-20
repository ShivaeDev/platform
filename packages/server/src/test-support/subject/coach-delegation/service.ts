import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { allows } from "#test/subject/coach-delegation/allows.ts";

export const CoachDelegation = defineService({
	id: "@shivaedev/server/test/subject/CoachDelegation",
	initialize: Effect.void,
	methods: () => ({ allows }),
	requires: [SqlClient.SqlClient],
});
