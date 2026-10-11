import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

const assertMaintainerScopeApproval = Effect.fn("FleetTest.assertMaintainerScopeApproval")(function* (record: FleetRecord, root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	expect(record).toMatchObject({
		attentionOwner: "maintainer",
		decision: { attentionOwner: "maintainer", reason: "Work is no longer approved or is done or superseded" },
		decisionPublished: true,
		stage: "needs-human",
	});
	const published = record.decision?.published;
	if (published === undefined) {
		return yield* Effect.die("Missing scope approval publication");
	}
	const parsed = metadataParse(yield* fs.readFileString(path.join(root, published.sourcePath)));
	expect(parsed.diagnostics).toEqual([]);
	expect(parsed.fields.attention).toMatchObject([{ id: record.decision?.id, responseFrom: ["maintainer"] }]);
	const restarted = yield* Fleet;
	expect((yield* restarted.get("one")).value).toMatchObject({
		attentionOwner: "maintainer",
		decision: { attentionOwner: "maintainer", id: record.decision?.id },
	});
	const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
	const views = yield* client("fleet.views", undefined);
	expect(views.waiting.maintainer).toMatchObject([{ decision: { id: record.decision?.id }, workId: "one" }]);
	expect(views.waiting.orchestrator).toEqual([]);
	expect(views.waiting.automation).toEqual([]);
});

for (const timing of ["between review passes", "while the reviewer finishes"] as const) {
	test(`approval removed ${timing} publishes a maintainer decision and persists its waiting group`, function* () {
		const observing = yield* Deferred.make<void>();
		const resume = yield* Deferred.make<void>();
		const betweenPasses = timing === "between review passes";
		const reviewScope = Effect.fn("FleetTest.reviewScope")(function* (fixture: EngineFixture<unknown>, root: string, source: string) {
			const fleet = yield* Fleet;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			if (betweenPasses) {
				expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
			}
			const reconciliation = betweenPasses ? undefined : yield* fleet.reconcile("one").pipe(Effect.forkChild);
			if (!betweenPasses) {
				yield* Deferred.await(observing);
			}
			yield* fs.writeFileString(path.join(root, "one.md"), source.replace("fleet: approved", "fleet: draft"));
			finishWorkers(fixture);
			yield* Deferred.succeed(resume, undefined);
			const stopped = reconciliation === undefined ? yield* fleet.reconcile("one") : yield* Fiber.join(reconciliation);

			expect(stopped.value.review).toBeUndefined();
			yield* fixture.restart(
				assertMaintainerScopeApproval(stopped.value, root).pipe(
					Effect.provideService(FileSystem.FileSystem, fs),
					Effect.provideService(Path.Path, path),
					Effect.scoped,
				),
			);
			expect(fixture.launched).toHaveLength(2);
		});
		yield* withFleetBoard(
			{
				reviewGate: betweenPasses ? Effect.void : Deferred.succeed(observing, undefined).pipe(Effect.andThen(Deferred.await(resume))),
				reviewRunning: betweenPasses,
			},
			reviewScope,
		);
	});
}
