import { Effect, SubscriptionRef } from "effect";

export function trackDomFetch(transport: typeof globalThis.fetch) {
	const pending = Effect.runSync(SubscriptionRef.make(false));
	let active = 0;
	const fetch: typeof globalThis.fetch = async (input, init) => {
		active += 1;
		Effect.runSync(SubscriptionRef.set(pending, true));
		try {
			return await transport(input, init);
		} finally {
			active -= 1;
			Effect.runSync(SubscriptionRef.set(pending, active > 0));
		}
	};
	return Object.assign(fetch, { pending: SubscriptionRef.changes(pending) });
}
