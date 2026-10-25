import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { boardReadCounts } from "#test/boardReadCounts.ts";
import { type HostFixture, hostFixture, readHostWork, task } from "#test/fleetHost.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { scheduledDaemonLayer } from "#test/readDaemon.ts";
import { startHostDaemon } from "#test/startHostDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeRecords } from "#test/storeState.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const boardReadDaemonStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const files = Object.fromEntries(
			Array.from({ length: 300 }, (_, index) => [`item.${index}.md`, task(`item.${index}`, index >= 40 && index < 50 ? "approved" : "held")]),
		);
		const now = yield* Clock.currentTimeMillis;
		const fixture = yield* hostFixture(files, { intervalSeconds: 1 });
		const records = yield* Effect.forEach(
			Array.from({ length: 50 }, (_, index) => index),
			(index) => seedRecord(fixture, index, now),
		).pipe(withBoardReadPass);
		yield* storeRecords(fixture.host, records).pipe(Effect.provide(hostDatabase(fixture.host, "fleet-read-seed", 1)));
		const running: { current?: Effect.Success<ReturnType<typeof startHostDaemon>> } = {};
		return { counts: boardReadCounts(), fixture, running };
	},
	inspect: ({ counts }) => counts.snapshot(),
	layer,
	name: "Fleet daemon Board reads",
	runIf: postgresEnabled,
	stages: [],
	verbs: (engine, story) => ({
		awaitCycles: (count: number) => {
			story.tell(`wait for ${count} admission cycles and done reconciliation`);
			return Effect.whileLoop({
				body: () => Effect.sleep("10 millis"),
				step: () => undefined,
				while: () => engine.counts.snapshot().cycles < count || engine.counts.snapshot().reconciles < 35,
			}).pipe(Effect.timeout("15 seconds"));
		},
		counts: () => engine.counts.snapshot(),
		peakPasses: () => engine.counts.peakPasses(),
		start: () => {
			story.tell("start the real daemon and its scheduler over 300 documents and 50 durable Fleet records");
			return engine.counts.observe(startHostDaemon(scheduledDaemonLayer(engine.fixture.host, engine.fixture.parts))).pipe(
				Effect.tap((running) =>
					Effect.sync(() => {
						engine.running.current = running;
					}),
				),
			);
		},
		status: () => {
			story.tell("request status from the running daemon");
			const running = engine.running.current;
			if (running === undefined) {
				throw new Error("Start the daemon first");
			}
			return running.client("daemon.status", {});
		},
		stop: () => {
			story.tell("stop the daemon and release its reads");
			const running = engine.running.current;
			if (running === undefined) {
				throw new Error("Start the daemon first");
			}
			return running.stop;
		},
	}),
});

function recordStage(index: number) {
	if (index < 25) {
		return "done";
	}
	return index < 40 ? "released" : "working";
}

const seedRecord = Effect.fn("FleetTest.seedRecord")(function* (fixture: HostFixture, index: number, now: number) {
	const workId = `item.${index}`;
	const step = recordStage(index);
	const work = yield* readHostWork(fixture, workId);
	const attempts =
		step === "working"
			? [
					{
						operationId: `operation-${index}`,
						receipt: { sessionId: `session-${index}`, turnId: `turn-${index}` },
						role: "worker" as const,
						status: "running" as const,
						submittedAt: now,
					},
				]
			: [];
	return {
		...statusRecord(workId, step),
		attempts,
		boardRevision: work.revision,
		boardSourcePath: work.sourcePath,
		...(step === "done" ? { result: { evidence: ["Already implemented"], head: "main-revision", kind: "no-change" as const } } : {}),
	};
});
