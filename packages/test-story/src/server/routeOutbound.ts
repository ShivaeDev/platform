import { Effect } from "effect";
import { inDom } from "#internal/domDocument.ts";
import { installOutbound } from "#internal/installOutbound.ts";

export function routeOutbound(routes: Readonly<Record<string, string>>) {
	return Effect.acquireRelease(
		Effect.promise(() => installOutbound(routes, inDom())),
		(restore) => Effect.sync(restore),
	).pipe(Effect.asVoid);
}
