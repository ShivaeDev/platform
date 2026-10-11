import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("reassignment recovers a failed supersession acknowledgement without publishing another question", () =>
	withEngine({ acknowledgeFailure: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const old = yield* askWorker(fixture);
			const changed = yield* fleet.reassign("one", old.decision.id, "maintainer");
			expect(changed.value.blocker).toContain("Board request acknowledgement pending");
			expect(changed.value.attentionOwner).toBe("maintainer");
			expect(changed.value.supersededDecisions?.[0]?.boardAcknowledged).toBeUndefined();
			const id = changed.value.decision?.id ?? "missing";
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const recovered = yield* restarted.reconcile("one");
					expect(recovered.value.decision?.id).toBe(id);
					expect(recovered.value.supersededDecisions?.[0]?.boardAcknowledged).toBe(true);
					expect(recovered.value.blocker).toBeUndefined();
					yield* restarted.reassign("one", id, "maintainer");
				}),
			);
			expect(fixture.decisions).toHaveLength(2);
			expect(fixture.acknowledgements).toMatchObject([{ decision: old.published, disposition: "superseded" }]);
			expect(fixture.launched).toHaveLength(1);
		}),
	));

test("concurrent reassignment commits one new decision and rejects stale decision IDs", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			expect(yield* fleet.reassign("one", "missing", "maintainer").pipe(Effect.flip)).toMatchObject({ reason: "stale" });
			yield* fleet.dispatch("one");
			const old = yield* askWorker(fixture);
			const results = yield* Effect.all(
				[
					fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
					fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
				],
				{ concurrency: "unbounded" },
			);
			expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
			const current = (yield* fleet.reconcile("one")).value;
			expect(current.attentionOwner).toBe("maintainer");
			expect(current.supersededDecisions).toHaveLength(1);
			expect(yield* fleet.reassign("one", old.decision.id, "orchestrator").pipe(Effect.flip)).toMatchObject({ reason: "stale" });
			expect(fixture.launched).toHaveLength(1);
		}),
	));
