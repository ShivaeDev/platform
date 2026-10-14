import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { withEngine } from "#test/engine.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { reportWorker } from "#test/reportWorker.ts";

const test = postgresTests("test");

for (const scenario of ["conflicting", "moved"] as const) {
	test(`closed Board work releases before recovering an open ${scenario} PR`, () => closedDelivery(scenario));
}

function closedDelivery(scenario: "conflicting" | "moved") {
	return Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			yield* withEngine(github, (fixture) =>
				Effect.gen(function* () {
					yield* reportWorker(fixture);
					const fleet = yield* Fleet;
					const ready = yield* fleet.reconcile("one");
					expect(ready.value.stage).toBe("needs-human");
					expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
					expect(ready.value.checks).toMatchObject({ head: HEAD, passed: true });
					expect(executing(ready.value)).toBe(false);
					const published = ready.value.decision?.published ?? (yield* Effect.die("Missing ready decision"));
					const settings = fixture.settings.length;
					fixture.boardStatus("one", "done");
					github.state.base = MOVED;
					github.state.mergeable = scenario === "conflicting" ? "CONFLICTING" : "MERGEABLE";
					github.state.head = scenario === "moved" ? MOVED : HEAD;
					const released = yield* fleet.reconcile("one");
					expect(released.value.stage).toBe("released");
					expect(released.value.releaseReason).toBe("Board status is done");
					expect(released.value.outcome).toBeUndefined();
					expect(released.value.decision).toBeUndefined();
					expect(released.value.result).toEqual(ready.value.result);
					expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published }]);
					expect(fixture.acknowledgements).toContainEqual({ decision: published, disposition: "superseded", recordedAt: expect.any(Number) });
					expect(fixture.settings).toHaveLength(settings);
					expect(fixture.launched).toHaveLength(2);
					expect(fixture.reviews).toEqual([HEAD]);
					expect((yield* fleet.reconcile("one")).version).toBe(released.version);
				}),
			);
		}),
	);
}

for (const head of [HEAD, MOVED]) {
	test(`closed Board work settles its ${head === HEAD ? "approved" : "unreviewed"} human merge before releasing for Board status`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const github = yield* mergedReviewGithub();
				yield* withEngine(github, (fixture) =>
					Effect.gen(function* () {
						yield* reportWorker(fixture);
						const fleet = yield* Fleet;
						yield* fleet.reconcile("one");
						const settings = fixture.settings.length;
						fixture.boardStatus("one", "done");
						github.state.status = "MERGED";
						github.state.head = head;
						const settled = yield* fleet.reconcile("one");
						expect(settled.value.stage).toBe(head === HEAD ? "completed" : "released");
						expect(settled.value.outcome).toEqual(head === HEAD ? { head: HEAD, revision: BASE, url: PR } : undefined);
						expect(settled.value.releaseReason).toBe(head === HEAD ? undefined : `PR #7 merged by a human at ${head}; Fleet review covered ${HEAD}`);
						expect(fixture.settings).toHaveLength(settings);
					}),
				);
			}),
		));
}
