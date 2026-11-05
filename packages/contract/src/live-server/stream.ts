import { Effect } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { makeLiveServer } from "#makeLiveServer.ts";

export function stream(server: Effect.Success<typeof makeLiveServer>) {
	return (keys: readonly Key[]) => Effect.succeed(server.stream(keys));
}
