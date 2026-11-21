import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { HandOverPlan, HandOverRefused } from "#test/account-deletion/HandOverPlan.ts";

export const handOver = Effect.fn("ProjectHandOver.handOver")(function* (userId: string) {
	const plan = yield* HandOverPlan;
	if (plan.mode === "none") {
		return;
	}
	const sql = yield* SqlClient.SqlClient;
	yield* sql`update projects set user_id = ${plan.receiver} where user_id = ${userId}`;
	if (plan.mode === "fails after giving projects to bob") {
		return yield* new HandOverRefused();
	}
});
