import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { decisionAnswer } from "#board/decisionAnswer.ts";
import { decisionCopy } from "#engine/decisionCopy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { Fleet } from "#fleet.ts";
import { Decision } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const ready: Decision = {
	code: "foreign-pr",
	id: "one.1",
	links: [],
	reason: "Reported PR must belong to the host repository",
	recommendation: "Release this cycle and inspect ownership",
};

describe("stable decision codes", () => {
	it("keeps a worker question as the card reason without guided actions", () => {
		const copy = decisionCopy({ ...ready, reason: "Which fixture should I use?", worker: { sessionId: "session", turnId: "turn" } });
		expect(copy.reason).toBe("Which fixture should I use?");
		expect(decisionAnswer(copy)).toBeUndefined();
	});
	it("rewording release-only text preserves the release-only answer", () => {
		const reworded = Schema.decodeUnknownSync(Decision)({ ...ready, reason: "This pull request belongs to another repository." });
		expect(reworded.code).toBe(ready.code);
		expect(decisionCopy(reworded)).toEqual(decisionCopy(ready));
		expect(decisionAnswer(decisionCopy(reworded))).toContain(':::option{id="release"}');
		expect(decisionAnswer(decisionCopy(reworded))).not.toContain(':::option{id="retry"}');
	});
	it("explains a decision stored without a code generically, keeps its reason as details and offers a retry", () => {
		const { code: _code, ...uncoded } = ready;
		const copy = decisionCopy(uncoded);
		expect(copy.reason).toBe(`Fleet stopped and needs your decision.\n\nDetails: ${ready.reason}`);
		expect(decisionAnswer(copy)).toContain(':::option{id="retry"}');
	});
	it("wording alone cannot select a release-only rule", () => {
		expect(decisionAnswer(decisionCopy({ ...ready, code: "fleet-integration" }))).toContain(':::option{id="retry"}');
		expect(Schema.is(Decision)({ ...ready, code: "unknown-code" })).toBe(false);
	});
	postgresTests("test")("reworded merge readiness sends requested changes to the existing worker after restart", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision === undefined) {
					return yield* Effect.die("Expected merge-ready decision");
				}
				expect(decision.code).toBe("reviewed-pr-ready");
				yield* fixture.replaceRecord({ ...stopped.value, decision: { ...decision, reason: "A human can merge this reviewed change now." } });
				const repaired = yield* fixture.restart(
					Fleet.pipe(Effect.flatMap((current) => current.resolve("one", decision.id, fixture.respond(decision.id, "retry")))),
				);
				expect(repaired.value.stage).toBe("repairing");
				expect(repaired.value.prompt).toContain("Requested changes to the existing PR:");
				expect(repaired.value.result).toEqual(stopped.value.result);
				expect(repaired.value.review).toBeUndefined();
				expect(repaired.value.checks).toBeUndefined();
			}),
		),
	);
	postgresTests("test")("reworded saved release-only reason rejects retry after restart without republishing", () =>
		withEngine({ resultQuery: () => Effect.fail(withFailureContext(new BadRequest({ message: ready.reason }), { code: "foreign-pr" })) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision === undefined) {
					return yield* Effect.die("Expected release-only decision");
				}
				expect(decision.code).toBe("foreign-pr");
				const reworded = { ...decision, reason: "This pull request belongs to another repository." };
				yield* fixture.replaceRecord({ ...stopped.value, decision: reworded });
				const resumed = yield* fixture.restart(Fleet.pipe(Effect.flatMap((current) => current.reconcile("one"))));
				expect(resumed.value.decision).toEqual(reworded);
				const failure = yield* fixture.restart(
					Fleet.pipe(
						Effect.flatMap((current) => current.resolve("one", decision.id, fixture.respond(decision.id, "retry"))),
						Effect.flip,
					),
				);
				expect(failure).toMatchObject({ _tag: "BadRequest", message: expect.stringContaining("Fleet cannot move a PR") });
			}),
		),
	);
});
