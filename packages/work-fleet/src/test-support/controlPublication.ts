import { readFileSync } from "node:fs";
import { join } from "node:path";
import { queryObjects } from "node:v8";
import { Context, Deferred, Effect, Fiber } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { HealthPublication } from "#engine/health.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { controlPublicationHost } from "#test/controlPublicationHost.ts";
import { dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { task } from "#test/fleetHost.ts";
import { MAIN } from "#test/mainSource.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

export const controlPublication = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: controlPublicationHost,
	inspect: (engine) => ({ turns: engine.fixture.provider.settings }),
	layer: postgresLayer,
	name: "Fleet control publication",
	runIf: postgresEnabled,
	stages: ["host"],
	verbs: (engine, story) => ({
		answer: () => {
			story.tell("answer the waiting worker");
			return daemonRequest(engine.port, (client) => client("daemon.answer", { text: "Use PostgreSQL.", workId: "one" }), "answer one", 1500);
		},
		archived: () => engine.fixture.provider.archived,
		awaitCleanup: () => engine.archive.entered.pipe(Effect.timeout("3 seconds")),
		blockCleanup: () => {
			story.tell("hold provider cleanup after the release response is recorded");
			return Effect.sync(engine.archive.enable);
		},

		blockLaunchPublication: () =>
			Effect.gen(function* () {
				story.tell("launch another item and hold its Board publication");
				yield* Context.get(engine.context, HealthPublication);
				engine.state.block = true;
				yield* engine.client("fleet.dispatch", { workId: "two" }).pipe(Effect.forkScoped);
				yield* Deferred.await(engine.entered).pipe(Effect.timeout("3 seconds"));
			}),
		continue: (message: string) => {
			story.tell("continue the existing worker");
			return daemonRequest(engine.port, (client) => client("fleet.continue", { message, workId: "one" }), "continue one", 1500);
		},
		dispatch: () => {
			story.tell("dispatch the initial worker");
			return dispatchAndWait(engine.client, "one");
		},
		flush: () => Context.get(engine.context, HealthPublication),
		get: () => engine.client("fleet.get", { workId: "one" }),
		loseAcknowledgement: (message: string) =>
			Effect.gen(function* () {
				story.tell("lose the HTTP acknowledgement after continue is recorded");
				engine.state.dropNext = true;
				const request = yield* engine.client("fleet.continue", { message, workId: "one" }).pipe(Effect.forkChild);
				yield* Deferred.await(engine.lost).pipe(Effect.timeout("1500 millis"));
				yield* Fiber.interrupt(request);
			}),
		prepareLaunch: () => {
			story.tell("prepare another launch");
			return engine.client("fleet.prepare", {
				cwd: "/synthetic",
				preparation: prepared({ baseRevision: MAIN.revision, observedAt: MAIN.observedAt }),
				prompt: "Launch another item",
				workId: "two",
			});
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
		// Per-iteration narration captures diagnostic stacks that retain completed fibers.
		reconcile: () => engine.client("fleet.reconcile", { workId: "one" }),
		release: () => {
			story.tell("release the waiting work");
			return daemonRequest(engine.port, (client) => client("daemon.release", { workIds: ["one"] }), "release one", 1500);
		},
		releaseCleanup: () => engine.archive.release,
		releasePublication: () => Deferred.succeed(engine.release, undefined),
		retainedFiberCount: () =>
			Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve))).pipe(
				Effect.andThen(Effect.withFiber((fiber) => Effect.sync(() => queryObjects(fiber.constructor, { format: "count" })))),
			),
		status: () => readFileSync(join(engine.fixture.host.boardDir, "fleet/status.md"), "utf8"),
		stop: () => engine.close,
		turns: () => engine.fixture.provider.settings.filter((call) => call.call === "turn"),
		waitReleased: () =>
			waitForRecord(engine.client, "one", (record) => record.step === "released" && record.attempts[0]?.sessionCleanupComplete === true),
		work: (workId: string) => engine.client("fleet.get", { workId }),
	}),
});

export function largePublicationBoard(count: number) {
	return controlPublication.trait("host", `the Board has ${count} tasks`, (engine) =>
		Effect.sync(() => {
			for (let index = 2; index < count; index += 1) {
				engine.fixture.write(`task-${index}.md`, task(`task.${index}`));
			}
		}),
	);
}
