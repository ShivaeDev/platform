import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { assertMaintainerScopeApproval, scopeApproval } from "#test/scopeApproval.ts";

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
			yield* restart(
				assertMaintainerScopeApproval(stopped.value, root).pipe(
					Effect.provideService(FileSystem.FileSystem, fs),
					Effect.provideService(Path.Path, path),
					Effect.scoped,
				),
			);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}
