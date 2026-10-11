import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { startReview } from "#test/startReview.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("restart after persisting the moved head launches one fresh reviewer before delivery", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			const launching = yield* Deferred.make<void>();
			let interrupted = false;
			yield* withEngine(
				{
					...github,
					reviewRunning: true,
					writeGate: (record) =>
						!interrupted && record.attempts.at(-1)?.reviewHead === MOVED
							? Deferred.succeed(launching, undefined).pipe(Effect.andThen(Effect.never))
							: Effect.void,
				},
				(fixture) =>
					Effect.gen(function* () {
						yield* startReview(fixture);
						const fleet = yield* Fleet;
						finishWorkers(fixture);
						const approved = yield* fleet.reconcile("one");
						github.state.head = MOVED;
						const moving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
						yield* Deferred.await(launching);
						const persisted = yield* fleet.get("one");
						expect(persisted.value.stage).toBe("reviewing");
						expect(persisted.value.result?.head).toBe(MOVED);
						expect(persisted.value.review).toEqual(approved.value.review);
						expect(persisted.value.resultObservations).toEqual([approved.value.result]);
						expect(persisted.value.checks).toBeUndefined();
						expect(persisted.value.decision).toBeUndefined();
						expect(fixture.launched).toHaveLength(2);
						yield* Fiber.interrupt(moving);
						interrupted = true;
						const recovered = yield* fixture.restart(fleet.reconcile("one"));
						expect(recovered.value.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
						expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(approved.value.review?.receipt.sessionId);
						yield* fixture.restart(fleet.reconcile("one"));
						expect(fixture.launched).toHaveLength(3);
						finishWorkers(fixture);
						github.state.status = "MERGED";
						const completed = yield* fixture.restart(fleet.reconcile("one"));
						expect(completed.value.stage).toBe("completed");
						expect(completed.value.outcome).toEqual({ head: MOVED, revision: BASE, url: PR });
						expect(completed.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
						expect(completed.value.checks).toMatchObject({ head: MOVED, passed: true });
						expect(fixture.reviews).toEqual([HEAD, MOVED]);
						expect(fixture.launched).toHaveLength(3);
					}),
			);
		}),
	));
