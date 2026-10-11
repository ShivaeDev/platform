import { Effect } from "effect";
import { asPath, keySelector, retainedPath } from "./paths.ts";
import { FieldFailure, type Holder } from "./shape.ts";
import type { statusOf } from "./status.ts";

export function trackRejections(values: Holder, selectors: Readonly<Record<string, unknown>> | undefined, status: ReturnType<typeof statusOf>) {
	const keys = new Map(Object.entries(selectors ?? {}).map(([name, select]) => [name, keySelector(select)]));
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
