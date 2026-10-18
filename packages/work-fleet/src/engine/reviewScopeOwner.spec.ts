import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";
import { RpcTest } from "effect/rpc";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { Fleet } from "#fleet.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { scopeApproval } from "#test/scopeApproval.ts";

for (const timing of ["between review passes", "while the reviewer finishes"] as const) {
	const setup = scopeApproval(timing);
	isolatedEngine.it(
		`approval removed ${timing} publishes a maintainer decision and persists its waiting group`,
		[markdownWork(), setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart, root, source }) {
			const context = setup.context();

			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			if (context.betweenPasses) {
				expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
			}
			const reconciliation = context.betweenPasses ? undefined : yield* fleet.reconcile("one").pipe(Effect.forkChild);
			if (!context.betweenPasses) {
				yield* Deferred.await(context.observing);
			}
			yield* fs.writeFileString(path.join(root, "one.md"), source.replace("fleet: approved", "fleet: draft"));
			finishWorkers();
			yield* Deferred.succeed(context.resume, undefined);
			const stopped = reconciliation === undefined ? yield* fleet.reconcile("one") : yield* Fiber.join(reconciliation);

			expect(stopped.value.review).toBeUndefined();
			expect(stopped.value).toMatchObject({
				attentionOwner: "maintainer",
				decision: { attentionOwner: "maintainer", reason: "Work is no longer approved" },
				decisionPublished: true,
				stage: "needs-human",
			});
			const published = stopped.value.decision?.published ?? (yield* Effect.die("Missing scope approval publication"));
			const parsed = metadataParse(yield* fs.readFileString(path.join(root, published.sourcePath)));
			expect(parsed.diagnostics).toEqual([]);
			expect(parsed.fields.attention).toMatchObject([{ id: stopped.value.decision?.id, responseFrom: ["maintainer"] }]);
			const persisted = yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.get("one"))));
			expect(persisted.value).toMatchObject({
				attentionOwner: "maintainer",
				decision: { attentionOwner: "maintainer", id: stopped.value.decision?.id },
			});
			const views = yield* restart(
				Effect.gen(function* () {
					const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
					return yield* client("fleet.views", undefined);
				}).pipe(Effect.scoped),
			);
			expect(views.waiting.maintainer).toMatchObject([{ decision: { id: stopped.value.decision?.id }, workId: "one" }]);
			expect(views.waiting.orchestrator).toEqual([]);
			expect(views.waiting.automation).toEqual([]);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}
