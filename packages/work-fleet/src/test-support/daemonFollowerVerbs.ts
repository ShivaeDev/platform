import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { DaemonStoryEngine } from "#test/DaemonStoryEngine.ts";
import { type FollowOptions, followerProcess } from "#test/followerProcess.ts";
import { storeState } from "#test/storeState.ts";

export function daemonFollowerVerbs(engine: DaemonStoryEngine, tell: (line: string) => void) {
	return {
		follow: (command: "wait" | "watch", ids: readonly string[], options: FollowOptions = {}) =>
			Effect.gen(function* () {
				tell(`start ${command} for ${ids.join(", ")}`);
				engine.follower = yield* followerProcess(engine.fixture.configFile, command, ids, { port: engine.daemon.port, ...options });
			}),
		store: (workId: string, record: Parameters<typeof storeState>[2]) => {
			tell(`Fleet records ${workId}`);
			return storeState(engine.fixture.host, workId, record).pipe(Effect.provideService(Reactivity.Reactivity, engine.daemon.reactivity));
		},
	};
}
