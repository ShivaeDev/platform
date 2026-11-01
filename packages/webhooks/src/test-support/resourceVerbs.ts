import { Deferred, Effect, Fiber } from "effect";
import type { InboxState } from "#test/host.ts";
import { deliver } from "#test/requests.ts";

export function resourceVerbs(state: InboxState, tell: (line: string) => void) {
	return {
		cancelResourceDelivery: () => {
			tell("github cancels the delivery while its mapping waits for a resource");
			return state.resources.request === undefined
				? Effect.die(new Error("No resource delivery is in flight"))
				: Fiber.interrupt(state.resources.request).pipe(Effect.asVoid);
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
		startResourceDelivery: () =>
			Effect.gen(function* () {
				tell("github sends a delivery whose mapping waits for a resource");
				state.resources.request = yield* deliver(state, "a delivery using a resource").pipe(Effect.forkScoped);
				yield* Deferred.await(state.resources.waiting);
			}),
	};
}
