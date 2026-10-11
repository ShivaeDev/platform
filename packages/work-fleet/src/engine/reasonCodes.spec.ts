import { describe, expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { decisionAnswer } from "#board/decisionAnswer.ts";
import { Fleet } from "#fleet.ts";
import { Decision } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const ready: Decision = {
	code: "reviewed-pr-ready",
	id: "one.1",
	links: [],
	reason: "Reviewed PR is ready to merge",
	recommendation: "Merge the reviewed head",
};

describe("stable decision codes", () => {
	it("rewording release-only text preserves the release-only answer", () => {
		const reworded = Schema.decodeUnknownSync(Decision)({ ...ready, reason: "A human can merge this reviewed change now." });
		expect(reworded.code).toBe(ready.code);
		expect(decisionAnswer(reworded)).toBe(decisionAnswer(ready));
		expect(decisionAnswer(reworded)).toContain(':::option{id="release"}');
		expect(decisionAnswer(reworded)).not.toContain(':::option{id="retry"}');
	});
	it("wording alone cannot select a release-only rule", () => {
		expect(decisionAnswer({ ...ready, code: "fleet-integration" })).toContain(':::option{id="retry"}');
		expect(Schema.is(Decision)({ ...ready, code: "unknown-code" })).toBe(false);
	});
	it.effect.skipIf(storageDatabaseUrl === undefined)("reworded saved merge readiness rejects retry after restart without republishing", () =>
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
				const reworded = { ...decision, reason: "A human can merge this reviewed change now." };
				yield* fixture.replaceRecord({ ...stopped.value, decision: reworded });
				const resumed = yield* fixture.restart(Fleet.pipe(Effect.flatMap((current) => current.reconcile("one"))));
				expect(resumed.value.decision).toEqual(reworded);
				const failure = yield* fixture.restart(
					Fleet.pipe(
						Effect.flatMap((current) => current.resolve("one", decision.id, fixture.respond(decision.id, "retry"))),
						Effect.flip,
					),
				);
				expect(failure).toMatchObject({ message: expect.stringContaining("Retry cannot merge"), reason: "invalid" });
			}),
		),
	);
});
