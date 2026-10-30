import { Effect } from "effect";

export function bundledClient() {
	return Effect.promise(() => import("#bundled-client"));
}
