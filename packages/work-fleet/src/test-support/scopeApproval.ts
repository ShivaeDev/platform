import { expect } from "@effect/vitest";
import { Deferred, Effect, FileSystem, Path } from "effect";
import { RpcTest } from "effect/rpc";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { engineScenario } from "#test/engineScenario.ts";

export const assertMaintainerScopeApproval = Effect.fn("FleetTest.assertMaintainerScopeApproval")(function* (record: FleetRecord, root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	expect(record).toMatchObject({
		attentionOwner: "maintainer",
		decision: { attentionOwner: "maintainer", reason: "Work is no longer approved" },
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

export function scopeApproval(timing: "between review passes" | "while the reviewer finishes") {
	return engineScenario("Board approval is removed during independent review", () =>
		Effect.gen(function* () {
			const observing = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const betweenPasses = timing === "between review passes";
			return {
				context: { betweenPasses, observing, resume },
				options: {
					reviewGate: betweenPasses ? Effect.void : Deferred.succeed(observing, undefined).pipe(Effect.andThen(Deferred.await(resume))),
					reviewRunning: betweenPasses,
				},
			};
		}),
	);
}
