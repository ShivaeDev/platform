import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import type { FleetRecord } from "#model.ts";
import { answerQueueFailure } from "#test/answerRecordingFailure.ts";
import { untilOutput } from "#test/follower.ts";
import { type FollowOptions, followerProcess } from "#test/followerProcess.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { stalledWatchProxy } from "#test/stalledWatchProxy.ts";
import { watchPrApi } from "#test/watchPrApi.ts";

export function watchEventVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function start(options: FollowOptions) {
		return Effect.gen(function* () {
			tell("start the Fleet event watcher through the CLI");
			const child = yield* followerProcess(engine.fixture.configFile, "watch", [], { timeout: 30, ...options });
			engine.followers.set("events", child);
		});
	}
	function follower() {
		const watch = engine.followers.get("events");
		if (!watch) {
			throw new Error("Start the event watcher first");
		}
		return watch;
	}
	return {
		awaitEvent: (kind: string) => untilOutput(follower(), `"kind":"${kind}"`),
		awaitWatchExit: () => Effect.promise(() => follower().done),
		eventErrors: () => follower().errors(),
		eventLines: (): readonly unknown[] =>
			follower()
				.output()
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
		eventOutput: () => follower().output(),
		failAnswerQueue: () => answerQueueFailure(engine.fixture.host).pipe(Effect.provideContext(engine.running.context)),
		observeProgress: (record: FleetRecord) => {
			const receipt = record.attempts.at(-1)?.receipt;
			const observation = receipt && engine.observedProvider.observations.get(receipt.turnId);
			if (!observation) {
				throw new Error("Expected a provider observation");
			}
			tell(`the provider reports progress on ${record.workId}`);
			engine.observedProvider.observations.set(observation.receipt.turnId, {
				...observation,
				progress: [{ id: "review-inspection", status: "running" }],
			});
		},
		prApi: () => watchPrApi,
		repositoryWithBoard: () =>
			Effect.gen(function* () {
				tell("create a repository with its Board in .work");
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped();
				execFileSync("git", ["init", "--quiet", root]);
				yield* fs.symlink(engine.fixture.host.boardDir, join(root, ".work"));
				return root;
			}),
		stalledWatchProxy: () => stalledWatchProxy(engine.running.port),
		watchDefault: (options: FollowOptions = {}) => {
			tell("watch Fleet with its default event selection and output");
			return start(options);
		},
		watchEvents: (options: FollowOptions = {}) => start({ json: true, prEvents: false, ...options }),
		watchRunning: () => follower().isRunning(),
	};
}
