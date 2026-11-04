import { Clock, Effect, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { authSession } from "#client/authSession.ts";

export const makeAuth = Effect.gen(function* () {
	const checked = yield* Queue.unbounded<void>();
	const started = yield* Queue.unbounded<void>();
	const clock = yield* Clock.Clock;
	const signOutResponse = Promise.withResolvers<void>();
	const state: { checks: Array<{ at: number; operation: "get-session" }>; hold: boolean; reachable: boolean; signedIn: boolean } = {
		checks: [],
		hold: false,
		reachable: true,
		signedIn: true,
	};
	const pending: Array<() => void> = [];
	const session = authSession(
		readSession(async () => {
			state.checks.push({ at: clock.currentTimeMillisUnsafe(), operation: "get-session" });
			Queue.offerUnsafe(started, undefined);
			if (state.hold) {
				await new Promise<void>((resolve) => pending.push(resolve));
			}
			Queue.offerUnsafe(checked, undefined);
			return {
				data: state.signedIn ? { user: { id: "alice" } } : null,
				error: state.reachable ? null : { code: "FAILED_TO_GET_SESSION" },
			};
		}),
	);
	const signOut = Atom.fn<void>()(() => Effect.tryPromise({ catch: (error) => error, try: () => signOutResponse.promise }));
	return { checked, pending, session, signOut, signOutResponse, started, state };
});
export type Auth = Effect.Success<typeof makeAuth>;
