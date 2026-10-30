import { Effect } from "effect";
import { asPath, type Key, retainedPath } from "./paths.ts";
import { type ArrayKeys, FieldFailure, type Fields, type Holder } from "./shape.ts";
import type { statusOf } from "./statusOf.ts";

export function trackRejections<TFields extends Fields>(
	values: Holder,
	selectors: ArrayKeys<TFields> | undefined,
	status: ReturnType<typeof statusOf>,
) {
	const keys: ReadonlyMap<string, Key> = new Map(Object.entries(selectors ?? {}));
	let previous = values.value;
	values.subscribe((next) => {
		status.rebase(previous, next, keys);
		previous = next;
	});
	return (submitted: unknown) =>
		(cause: unknown): Effect.Effect<void> =>
			Effect.sync(() => {
				if (cause instanceof FieldFailure) {
					const path = retainedPath(cause.segments ?? asPath(cause.path), submitted, values.value, keys);
					if (path !== undefined) {
						status.note(path, cause.message);
					}
				}
			});
}
