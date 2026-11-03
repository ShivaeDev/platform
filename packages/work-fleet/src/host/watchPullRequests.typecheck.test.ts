import { Effect } from "effect";
import { expectTypeOf } from "vitest";
import type { WatchError } from "@shivaedev/pr-watch/model.ts";
import { watchPullRequests } from "#host/watchPullRequests.ts";
import type { WatchStreamOptions } from "#host/watchStream.ts";

function watcherFailure(options: WatchStreamOptions) {
	const watched = watchPullRequests(options, () => Effect.void).pipe(Effect.flatMap(({ failed }) => failed));

	expectTypeOf<Extract<Effect.Error<typeof watched>, WatchError>>().toEqualTypeOf<WatchError>();
}

void watcherFailure;
