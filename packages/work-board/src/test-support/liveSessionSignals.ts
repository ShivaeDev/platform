import { Clock, Effect, Fiber } from "effect";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { session } from "#client/session.ts";
import { mergedPullRequest } from "./pullRequestsFixture.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

export function liveSessionSignals(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		liveSessionSettles: () => screenSettles(engine, tell),
		pullRequestMerged: (workId: string, file: string, source: string) =>
			Effect.gen(function* () {
				tell(`Fleet merges the pull request of ${workId} and an outside editor writes ${file}`);
				if (!(engine.session && engine.sessionFleet)) {
					throw new Error("The live session has no Fleet work items");
				}
				const activity = activityScreenSignal(clientActivity(session(engine.session.environment)));
				const hint = yield* screenDriver({ act: screenAct, activity, root: () => document.body, tell })
					.nextLiveHint()
					.pipe(Effect.forkChild({ startImmediately: true }));
				engine.sessionFleet = mergedPullRequest(engine.sessionFleet, workId, yield* Clock.currentTimeMillis);
				engine.session.notes.write(file, source);
				yield* Fiber.join(hint);
				yield* screenSettles(engine, tell);
			}),
	};
}
