import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { DelegationRequest } from "@shivaedev/identity/subject.ts";

// The coaching app's rule: a coach assigned to a client may read that client's coaching data and change none of it.
export const allows = Effect.fn("CoachDelegation.allows")(function* ({ kind, subject }: DelegationRequest) {
	const coach = yield* CurrentViewer;
	if (Option.isNone(coach) || kind === "write") {
		return false;
	}
	const sql = yield* SqlClient.SqlClient;
	const assigned = yield* sql`select 1 from coaching_assignments where coach = ${coach.value.id} and client = ${subject}`.pipe(
		Effect.catchTag("SqlError", () => Effect.fail(new AuthUnavailable({ message: "Coaching assignments are unavailable" }))),
	);
	return assigned.length > 0;
});
