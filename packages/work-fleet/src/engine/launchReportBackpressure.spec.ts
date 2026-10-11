import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { markdownBoard } from "#board/markdown.ts";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { reportBoard } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("report launch backpressure", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("a queued report retains its report prompt through restart and publishes its result", () =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			let now = 100;
			let reject = true;
			return yield* withEngine(
				{
					now: () => now,
					submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
				},
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						const fleet = yield* Fleet;
						yield* cycle;
						expect((yield* fleet.get("one")).value).toMatchObject({ deliverable: "report", stage: "prepared" });
						reject = false;
						now = 30_099;
						yield* fixture.restart(cycle);
						expect(fixture.launched).toHaveLength(1);
						now = 30_100;
						yield* fixture.restart(cycle);
						expect(fixture.launched).toHaveLength(2);
						const [observation] = fixture.observations.values();
						expect(observation?.output).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR.");
						expect(observation?.output).toContain("Never publish attachments to git or GitHub.");
						finishWorkers(fixture);
						const completed = (yield* fleet.reconcile("one")).value;
						expect(completed.stage).toBe("completed");
						expect(completed.launchRetry).toBeUndefined();
						expect(completed.report?.receipt).toEqual(observation?.receipt);
						expect(views([completed]).completed[0]?.links).toEqual([completed.report?.sourcePath]);
						expect(fixture.reviews).toEqual([]);
					}),
				markdownBoard(root).pipe(Layer.provide(NodeServices.layer)),
			);
		}).pipe(Effect.provide(NodeServices.layer)));
});
