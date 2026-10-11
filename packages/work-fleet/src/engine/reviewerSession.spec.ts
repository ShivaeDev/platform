import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import type { WorkResult } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("independent reviewer sessions", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("launches asynchronously with host settings and accepts only a completed verdict", () =>
		withEngine({ launch: { effort: "high", model: "host-model", serviceTier: "priority" }, reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const attempt = reviewing.value.attempts.at(-1);
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.review).toBeUndefined();
				expect(attempt).toMatchObject({ reviewHead: "head-one-0", role: "reviewer", status: "running" });
				const start = fixture.starts.at(-1);
				expect(start).toMatchObject({ access: "read-only", settings: { effort: "high", model: "host-model", serviceTier: "priority" } });
				expect(start?.prompt).toContain(fixture.work("one").context);
				expect(start?.prompt).toContain("https://example.invalid/pr/one");
				expect(start?.prompt).not.toContain("Implement one");
				finishWorkers(fixture);
				const completed = yield* fixture.restart(fleet.reconcile("one"));
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.review).toMatchObject({ head: "head-one-0", receipt: attempt?.receipt, verdict: "approved" });
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	test("recovers a lost reviewer turn response by its durable session without another launch", () =>
		withEngine({ lostReviewAcknowledgement: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const lost = yield* fleet.reconcile("one");
				expect(lost.value.attempts.at(-1)).toMatchObject({ role: "reviewer", sessionId: "session-operation-2", status: "submitting" });
				expect(lost.value.attempts.at(-1)?.receipt).toBeUndefined();
				yield* fleet.resolve("one", lost.value.decision?.id ?? "missing", fixture.respond(lost.value.decision?.id ?? "missing", "retry"));
				expect((yield* fixture.restart(fleet.reconcile("one"))).value.stage).toBe("completed");
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	for (const reviewExecution of ["failed", "interrupted"] as const) {
		test(`retains terminal reviewer ${reviewExecution} evidence without accepting a verdict`, () =>
			withEngine({ reviewExecution }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const failed = yield* fleet.reconcile("one");
					expect(failed.value.stage).toBe("needs-human");
					expect(failed.value.attempts.at(-1)?.status).toBe(reviewExecution);
					expect(failed.value.review).toBeUndefined();
					expect(failed.value.outcome).toBeUndefined();
				}),
			));
	}
	test("a human retry after confirmed reviewer failure starts a fresh independent session", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const original = reviewing.value.attempts.at(-1)?.receipt;
				if (original === undefined) {
					return yield* Effect.die(new Error("Reviewer receipt missing"));
				}
				fixture.observations.set(original.turnId, { execution: "failed", output: "Provider failure", provisioning: "ready", receipt: original });
				const failed = yield* fleet.reconcile("one");
				const id = failed.value.decision?.id ?? "missing";
				yield* fleet.resolve("one", id, fixture.respond(id, "retry"));
				const retry = yield* fleet.reconcile("one");
				expect(retry.value.stage).toBe("reviewing");
				expect(retry.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(original.sessionId);
				expect(retry.value.attempts.at(-1)?.status).toBe("running");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.launched).toHaveLength(3);
			}),
		));
	test("keeps approval on the old head and starts fresh review when the PR head moves", () => {
		let result: WorkResult = { head: "first-head", kind: "change", paths: ["src/one.ts"], pr: "https://example.invalid/pr/one" };
		return withEngine({ resultQuery: () => Effect.succeed(result), reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				result = { ...result, head: "second-head" };
				finishWorkers(fixture);
				const moved = yield* fleet.reconcile("one");
				expect(moved.value.stage).toBe("reviewing");
				expect(moved.value.result?.head).toBe("second-head");
				expect(moved.value.review?.head).toBe("first-head");
				expect(moved.value.checks).toBeUndefined();
				expect(fixture.merged).toHaveLength(0);
				const fresh = yield* fleet.reconcile("one");
				expect(fresh.value.attempts.at(-1)).toMatchObject({ reviewHead: "second-head", status: "running" });
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.reviews).toEqual(["first-head", "second-head"]);
				expect(fixture.merged).toEqual(["second-head"]);
			}),
		);
	});
});
