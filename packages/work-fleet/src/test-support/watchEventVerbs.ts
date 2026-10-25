import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { answerQueueFailure } from "#test/answerRecordingFailure.ts";
import { untilOutput } from "#test/follower.ts";
import { type FollowOptions, followerProcess } from "#test/followerProcess.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function watchEventVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function follower() {
		const watch = engine.followers.get("events");
		if (!watch) {
			throw new Error("Start the event watcher first");
		}
		return watch;
	}
	return {
		awaitEvent: (kind: string) => untilOutput(follower(), `"kind":"${kind}"`),
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
		watchEvents: (options: FollowOptions = {}) =>
			Effect.gen(function* () {
				tell("watch Fleet JSON events through the CLI");
				const child = yield* followerProcess(engine.fixture.configFile, "watch", [], { timeout: 30, ...options });
				engine.followers.set("events", child);
			}),
	};
}
