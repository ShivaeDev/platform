import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { PublicationFailure } from "#server/PublicationFailure.ts";

function failure(cause: unknown): PublicationFailure {
	return Schema.is(PublicationFailure)(cause)
		? cause
		: Object.defineProperty(
				new ServiceUnavailable({
					message: "The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
				}),
				"cause",
				{ value: cause },
			);
}

export function publicationEffect(operation: (signal: AbortSignal) => Promise<void>) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const controller = new AbortController();
			return { controller, running: operation(controller.signal) };
		}),
		({ running }) => Effect.tryPromise({ catch: failure, try: () => running }),
		({ controller, running }) =>
			Effect.promise(async () => {
				controller.abort();
				// Interruption waits for native IO and its cleanup before releasing the publication's scope.
				await running.catch(() => undefined);
			}),
	);
}
