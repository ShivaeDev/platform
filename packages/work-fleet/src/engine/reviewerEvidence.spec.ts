import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { reviewerReply } from "#test/reviewerReply.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const approval = `FLEET_REVIEW: ${JSON.stringify({
	evidence: ["Read the diff at head-one-0", "Required checks passed at head-one-0", "CI job logs and artifacts unavailable: HTTP 403"],
	findings: [],
	head: "head-one-0",
	verdict: "approve",
})}`;

describe("reviewer evidence and verdict follow-up", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("accepts approval citing unavailable logs and passing exact-head checks", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const receipt = yield* reviewerReply(fixture, reviewing, approval);
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.review).toMatchObject({ receipt, verdict: "approved" });
				expect(completed.value.review?.evidence).toContain("CI job logs and artifacts unavailable: HTTP 403");
				expect(completed.value.checks).toMatchObject({ head: "head-one-0", passed: true });
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	for (const malformed of ["Cannot see CI job logs: HTTP 403", "FLEET_REVIEW: invalid"]) {
		test(`continues the same reviewer thread once to fix ${JSON.stringify(malformed)}`, () =>
			withEngine({ launch: { effort: "high", model: "host-model" }, reviewRunning: true }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const reviewing = yield* fleet.reconcile("one");
					const original = yield* reviewerReply(fixture, reviewing, malformed);
					const followUp = yield* fleet.reconcile("one");
					const attempt = followUp.value.attempts.at(-1);
					expect(followUp.value.stage).toBe("reviewing");
					expect(followUp.value.decision).toBeUndefined();
					expect(followUp.value.review).toBeUndefined();
					expect(attempt).toMatchObject({ reviewHead: "head-one-0", role: "reviewer", sessionId: original.sessionId });
					expect(attempt?.receipt?.turnId).not.toBe(original.turnId);
					expect(attempt?.prompt).toContain("Your previous reply did not contain a parseable verdict");
					expect(attempt?.prompt).toContain('"verdict":"approve"');
					expect(attempt?.settings).toEqual({ effort: "high", model: "host-model" });
					expect(fixture.reviews).toEqual(["head-one-0", "head-one-0"]);
					expect(followUp.value.attempts.at(-2)?.output).toBe(malformed);
					const receipt = yield* reviewerReply(fixture, followUp, approval);
					const completed = yield* fixture.restart(fleet.reconcile("one"));
					expect(completed.value.stage).toBe("completed");
					expect(completed.value.review).toMatchObject({ receipt, verdict: "approved" });
					expect(fixture.launched).toHaveLength(2);
					expect(completed.value.attempts).toHaveLength(3);
				}),
			));
	}
	test("reconciles a lost follow-up acknowledgement on the same thread after restart", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const original = yield* reviewerReply(fixture, reviewing, "No verdict");
				fixture.loseAcknowledgement();
				const lost = yield* fleet.reconcile("one");
				const intent = lost.value.attempts.at(-1);
				expect(intent).toMatchObject({ sessionId: original.sessionId, status: "submitting" });
				expect(intent?.receipt).toBeUndefined();
				const recovered = yield* fixture.restart(fleet.reconcile("one"));
				expect(recovered.value.attempts.at(-1)).toMatchObject({ operationId: intent?.operationId, status: "running" });
				const receipt = yield* reviewerReply(fixture, recovered, approval);
				expect(receipt.sessionId).toBe(original.sessionId);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.launched).toHaveLength(2);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(3);
			}),
		));
	test("a second malformed reply needs a human after restart without another follow-up", () =>
		withEngine({ reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				const original = yield* reviewerReply(fixture, reviewing, "No verdict");
				const followUp = yield* fleet.reconcile("one");
				const receipt = yield* reviewerReply(fixture, followUp, "FLEET_REVIEW: invalid");
				expect(receipt.sessionId).toBe(original.sessionId);
				const invalid = yield* fixture.restart(fleet.reconcile("one"));
				expect(invalid.value.stage).toBe("needs-human");
				expect(invalid.value.decision?.reason).toContain("malformed");
				expect(invalid.value.review).toBeUndefined();
				expect(invalid.value.outcome).toBeUndefined();
				expect(invalid.value.attempts.at(-1)).toMatchObject({ output: "FLEET_REVIEW: invalid", receipt, status: "completed" });
				expect(fixture.merged).toHaveLength(0);
				const unchanged = yield* fleet.reconcile("one");
				expect(unchanged.value.stage).toBe("needs-human");
				expect(unchanged.value.outcome).toBeUndefined();
				expect(unchanged.value.attempts).toHaveLength(3);
				expect(fixture.launched).toHaveLength(2);
				expect(invalid.value.attempts).toHaveLength(3);
			}),
		));
});
