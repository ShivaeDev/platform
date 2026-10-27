import { Context, Effect, Option } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { CommandInvalidation } from "@shivaedev/contract/serverMetadata.ts";
import { ChangeObserver, invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { sessionKeyContext } from "#server/sessionKeys.ts";

export function commandChanges<A, E, R>(effect: Effect.Effect<A, E, R>, rpc: Rpc.AnyWithProps, payload: unknown) {
	const invalidates = Context.getOption(rpc.annotations, CommandInvalidation);
	if (Option.isNone(invalidates)) {
		return effect;
	}
	const declared = invalidates.value;
	return Effect.gen(function* () {
		const context = yield* sessionKeyContext(rpc);
		const sql = yield* Effect.serviceOption(SqlClient.SqlClient);
		const reactivity = yield* Effect.serviceOption(Reactivity.Reactivity);
		if (Option.isNone(reactivity)) {
			return yield* effect;
		}
		const published = new Set<unknown>();
		const observer = yield* ChangeObserver;
		const result = yield* effect.pipe(
			Effect.provideService(ChangeObserver, (event) => {
				if (event._tag === "Published") {
					for (const key of event.changes) {
						published.add(key);
					}
				}
				return observer(event);
			}),
		);
		const viewer = yield* CurrentViewer;
		const keys = invalidationKeys(declared(payload, result, viewer), context).filter((key) => !published.has(key));
		if (keys.length > 0) {
			const announce = Option.isNone(sql)
				? reactivity.value.invalidate(keys)
				: invalidateOnCommit(keys).pipe(
						transact({ onSqlError: (error) => error }),
						Effect.provideService(SqlClient.SqlClient, sql.value),
						Effect.provideService(Reactivity.Reactivity, reactivity.value),
					);
			yield* announce.pipe(Effect.catchCause((cause) => Effect.logError("Committed command invalidation failed", cause)));
		}
		return result;
	});
}
