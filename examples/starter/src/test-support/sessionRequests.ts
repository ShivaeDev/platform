import type { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";

type SessionResult = AsyncResult.AsyncResult<unknown, unknown>;

function failureOf(result: SessionResult | undefined): Cause.Cause<unknown> | undefined {
	return result !== undefined && AsyncResult.isFailure(result) ? result.cause : undefined;
}

// A failed session check reads as waiting until a retry answers, so waiting alone cannot tell a retry on the wire from one
// waiting for its time. A session request stays open from the moment the auth client sends it until the session shows
// its answer: a settled result, or a failure other than the one on screen when the request went out.
export function sessionRequests(transport: typeof globalThis.fetch) {
	let read: () => SessionResult | undefined = () => undefined;
	let open: (Cause.Cause<unknown> | undefined)[] = [];
	const fetch: typeof globalThis.fetch = (input, init) => {
		if ((input instanceof Request ? input.url : input.toString()).includes("/api/auth/get-session")) {
			open.push(failureOf(read()));
		}
		return transport(input, init);
	};
	return {
		fetch,
		pending: (registry: AtomRegistry.AtomRegistry, session: Atom.Atom<SessionResult>) => {
			read = () => registry.get(session);
			const result = read();
			const failure = failureOf(result);
			open = open.filter((shown) => result.waiting && (failure === undefined || failure === shown));
			return open.length > 0 || (result.waiting && failure === undefined);
		},
	};
}
