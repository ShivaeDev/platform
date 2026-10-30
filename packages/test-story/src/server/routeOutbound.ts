import { Effect } from "effect";
import { inDom } from "#internal/domDocument.ts";
import { installOutbound } from "#internal/installOutbound.ts";

export function routeOutbound(routes: Readonly<Record<string, string>>, options: { readonly passthrough?: boolean } = {}) {
	return Effect.acquireRelease(
		Effect.promise(() => installOutbound(routes, !options.passthrough || inDom())),
		(restore) => Effect.sync(restore),
	).pipe(Effect.asVoid);
}
