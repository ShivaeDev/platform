import * as Effect from "effect/Effect";

export function pageFetch(url: string, pending: (busy: boolean) => Effect.Effect<void>) {
	const fetch = globalThis.fetch;
	const previousUrl = window.location.href;
	window.location.href = url;
	let active = 0;
	globalThis.fetch = async (input, init) => {
		active += 1;
		Effect.runSync(pending(true));
		try {
			return await fetch(typeof input === "string" ? new URL(input, window.location.href) : input, init);
		} finally {
			active -= 1;
			Effect.runSync(pending(active > 0));
		}
	};
	return () => {
		globalThis.fetch = fetch;
		window.location.href = previousUrl;
	};
}
