import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { controlPublicationHost } from "#test/controlPublicationHost.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

export const controlPublication = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: controlPublicationHost,
	inspect: (engine) => ({ turns: engine.fixture.provider.settings }),
	layer: postgresLayer,
	name: "Fleet control publication",
	runIf: postgresEnabled,
	stages: [],
	verbs: (engine, story) => ({
		archived: () => engine.fixture.provider.archived,
		awaitCleanup: () => engine.archive.entered.pipe(Effect.timeout("3 seconds")),
		blockCleanup: () => {
			story.tell("hold provider cleanup after the release response is recorded");
			return Effect.sync(engine.archive.enable);
		},
		dispatch: () => {
			story.tell("dispatch the initial worker");
			return dispatchAndWait(engine.client, "one", engine.context);
		},
		question: () =>
			Effect.gen(function* () {
				story.tell("finish the worker turn with a question");
				const record = yield* engine.client("fleet.get", { workId: "one" });
				const receipt = record.attempts.at(-1)?.receipt;
				const observation = receipt === undefined ? undefined : engine.fixture.provider.observations.get(receipt.turnId);
				if (receipt === undefined || observation === undefined) {
					return yield* Effect.die("Dispatch a worker before asking a question");
				}
				engine.fixture.provider.observations.set(receipt.turnId, {
					...observation,
					execution: "completed",
					output: "FLEET_QUESTION: Which storage?",
				});
				return yield* engine.client("fleet.reconcile", { workId: "one" });
			}),
		release: () => {
			story.tell("release the waiting work");
			return daemonRequest(engine.port, (client) => client("daemon.release", { workIds: ["one"] }), "release one", 1500);
		},
		releaseCleanup: () => engine.archive.release,
		waitReleased: () =>
			waitForRecord(
				engine.client,
				"one",
				(record) => record.step === "released" && record.attempts[0]?.sessionCleanupComplete === true,
				engine.context,
			),
	}),
});
