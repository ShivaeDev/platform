import { Effect } from "effect";
import { BrowserCheckError } from "#BrowserCheckError.ts";

export function attempt<A>(run: () => Promise<A>) {
	return Effect.tryPromise({
		catch: (cause) => new BrowserCheckError({ message: String(cause) }),
		try: run,
	});
}
