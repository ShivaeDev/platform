import type { Effect } from "effect";
import type { makeLiveServer } from "#makeLiveServer.ts";

export function resync(server: Effect.Success<typeof makeLiveServer>) {
	return () => server.resync;
}
