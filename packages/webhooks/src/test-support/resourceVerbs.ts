import { Deferred, Effect, Fiber } from "effect";
import { SqlClient } from "effect/sql";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import type { InboxState } from "#test/host.ts";
import { deliver } from "#test/requests.ts";

export function resourceVerbs(state: InboxState, tell: (line: string) => void) {
	return {
		awaitResourceRelease: () => Deferred.await(state.resources.releasing),
		awaitResourceRetry: () =>
			state.resources.retry === undefined ? Effect.die(new Error("No resource retry is in flight")) : Fiber.join(state.resources.retry),
		cancelResourceDelivery: () => {
			tell("github cancels the delivery while its mapping waits for a resource");
			return state.resources.request === undefined
				? Effect.die(new Error("No resource delivery is in flight"))
				: Fiber.interrupt(state.resources.request).pipe(Effect.asVoid);
		},
		finishReleasingResource: () => {
			tell("the acquired resource finishes releasing");
			return Deferred.succeed(state.resources.releasePermit, undefined);
		},
		mappingScopes: () =>
			Effect.sync(() => {
				const scopes = state.resources.scopes;
				if (scopes.length !== 2) {
					return `${scopes.length} mappings`;
				}
				return scopes[0] === scopes[1] ? "shared" : "separate";
			}),
		resourceLifecycle: () => Effect.sync(() => [...state.resources.lifecycle]),
		resourcesBecomeAvailable: () =>
			Effect.sync(() => {
				tell("resources become available for new mappings");
				state.resources.blocked = false;
			}),
		retryProgress: () =>
			Effect.gen(function* () {
				const retry = state.resources.retry;
				if (retry === undefined) {
					return yield* Effect.die(new Error("No resource retry is in flight"));
				}
				const sql = yield* SqlClient.SqlClient;
				const waiting = sql<{ waiting: boolean }>`select exists (
					select 1 from pg_stat_activity where datname = current_database()
					and wait_event_type = 'Lock' and query like 'insert into %webhook_receipts%'
				) as waiting`;
				return yield* Effect.raceFirst(
					Fiber.join(retry).pipe(Effect.as("answered before release")),
					observeUntil(waiting, ([row]) => row?.waiting === true, "the retry to wait on the receipt", { clock: "test" }).pipe(
						Effect.as("waiting for release"),
					),
				);
			}),
		startResourceDelivery: () =>
			Effect.gen(function* () {
				tell("github sends a delivery whose mapping waits for a resource");
				state.resources.request = yield* deliver(state, "a delivery using a resource").pipe(Effect.forkScoped);
				yield* Deferred.await(state.resources.waiting);
			}),
		startResourceRetry: () =>
			Effect.gen(function* () {
				tell("github retries the cancelled resource delivery");
				state.resources.retry = yield* deliver(state, "a delivery using a resource").pipe(Effect.forkScoped);
			}),
	};
}
