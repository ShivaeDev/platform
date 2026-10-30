import { Effect } from "effect";
import { installOutbound } from "#internal/installOutbound.ts";

export function routeOutbound(routes: Readonly<Record<string, string>>, options: { readonly passthrough?: boolean } = {}) {
	return Effect.acquireRelease(
		Effect.promise(() => installOutbound(routes, !options.passthrough || Reflect.get(globalThis, Symbol.for("test-story.dom")) === true)),
		(restore) => Effect.sync(restore),
	).pipe(Effect.asVoid);
}
