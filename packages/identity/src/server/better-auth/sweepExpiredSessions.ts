import { DateTime, Effect, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { sessionKeys } from "#signedInSessions.ts";

const SweepResult = Schema.Tuple([Schema.Struct({ removed: Schema.NumberFromString })]);

export const sweepExpiredSessions = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const now = DateTime.toDateUtc(yield* DateTime.now);
	const existing = yield* Effect.serviceOption(Reactivity.Reactivity);
	const reactivity = Option.isSome(existing) ? existing.value : yield* Reactivity.make;
	return yield* Effect.gen(function* () {
		const rows = yield* sql`with expired as (
			delete from "session" where "expiresAt" <= ${now} returning 1
		) select count(*)::text as removed from expired`;
		const [result] = yield* Schema.decodeUnknownEffect(SweepResult)(rows);
		if (result.removed > 0) {
			yield* invalidateOnCommit(invalidationKeys([sessionKeys.list]));
		}
		return result.removed;
	}).pipe(transact(), Effect.provideService(Reactivity.Reactivity, reactivity));
}).pipe(Effect.withSpan("Identity.sweepExpiredSessions"));
