import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import type { loaderHost } from "./loaderHost.ts";

export function loaderResponses(
	host: Effect.Success<ReturnType<typeof loaderHost>>,
	registry: () => AtomRegistry.AtomRegistry,
	tell: (line: string) => void,
) {
	return {
		next: () =>
			Effect.sync(() => {
				tell("hold the next response");
				host.next();
			}),
		rename: (title: string) =>
			Effect.promise(async () => {
				tell(`rename and invalidate the note: ${title}`);
				await act(async () => {
					await Effect.runPromise(AtomRegistry.getResult(registry(), host.rename(title)));
				});
			}),
		respond: (title: string) =>
			Effect.promise(async () => {
				tell(`the server responds: ${title}`);
				await act(async () => host.respond(title));
			}),
	};
}
