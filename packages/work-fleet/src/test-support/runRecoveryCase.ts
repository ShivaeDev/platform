import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { releaseOnly } from "#engine/releaseOnly.ts";
import { Fleet } from "#fleet.ts";
import { backlog, executing } from "#model.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import type { RecoveryCase, RecoveryContext } from "#test/recoveryCase.ts";
import { recoveryCases } from "#test/recoveryCases.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const exerciseRecoveryCase = Effect.fn("Test.exerciseRecoveryCase")(function* (
	scenario: RecoveryCase,
	context: RecoveryContext,
	action: "retry" | "release",
) {
	yield* scenario.enter(context);
	const fleet = yield* Fleet;
	const stopped = (yield* fleet.get("one")).value;
	const submissionCalls = context.fixture.settings.length;
	expect(stopped.stage).toBe("needs-human");
	const decision = stopped.decision;
	if (decision?.published === undefined) {
		return yield* Effect.die("Decision must be durably published");
	}
	if (typeof scenario.reason === "string") {
		expect(decision.reason).toBe(scenario.reason);
	} else {
		expect(decision.reason).toMatch(scenario.reason);
	}
	const document = readFileSync(join(context.root, decision.published.sourcePath), "utf8");
	const explanation = decision.worker === undefined ? releaseOnly(decision.reason) : undefined;
	if (decision.worker === undefined) {
		expect(document).toContain(':::option{id="release"}');
		expect(document.includes(':::option{id="retry"}')).toBe(explanation === undefined);
	} else {
		expect(document).toContain("guided release answer");
	}
	const restored = yield* context.fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.get("one"))));
	expect(restored.value.decision).toEqual(decision);
	if (action === "retry" && explanation !== undefined) {
		expect(document).toContain(explanation);
		const response = answerReport(context.root, decision.published, "retry");
		const rejected = yield* context.fixture.restart(
			Fleet.pipe(
				Effect.flatMap((resumed) => resumed.resolve("one", decision.id, response)),
				Effect.flip,
			),
		);
		expect(rejected).toMatchObject({ message: explanation, reason: "invalid" });
		expect((yield* fleet.get("one")).value).toEqual(stopped);
		return;
	}
	yield* scenario.restore?.(context) ?? Effect.void;
	const response = answerReport(context.root, decision.published, action);
	const recovered = yield* context.fixture.restart(
		Effect.gen(function* () {
			const resumed = yield* Fleet;
			let updated = yield* resumed.resolve("one", decision.id, response);
			if (updated.value.stage === "prepared") {
				updated = yield* resumed.dispatch("one");
			}
			if (updated.value.stage !== "released") {
				updated = yield* resumed.reconcile("one");
				updated = yield* resumed.reconcile("one");
			}
			return updated;
		}),
	);
	expect(recovered.value.decision?.reason).not.toBe(decision.reason);
	if (action === "release") {
		expect(recovered.value.stage).toBe("released");
		expect(context.fixture.settings).toHaveLength(submissionCalls);
		expect(recovered.value.attempts).toHaveLength(stopped.attempts.length);
		expect(executing(recovered.value)).toBe(false);
		expect(backlog(recovered.value)).toBe(false);
		expect((yield* fleet.list()).map(({ value }) => value.stage)).toEqual(["released"]);
		if (stopped.result?.kind === "change") {
			expect(yield* context.fixture.foreignReservations()).toContainEqual(expect.objectContaining({ owner: stopped.result.pr }));
		}
	} else {
		if (scenario.progress === undefined) {
			return yield* Effect.die("Retry needs an explicit progress assertion");
		}
		scenario.progress(context, stopped, recovered.value);
	}
	const repeated = yield* context.fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, response))));
	expect(repeated.value.attempts).toEqual(recovered.value.attempts);
	expect(repeated.value.responses).toEqual(recovered.value.responses);
});
export const runRecoveryCase = Effect.fn("Test.runRecoveryCase")(function* (name: string, action: "retry" | "release") {
	const scenario = recoveryCases().find((candidate) => candidate.name === name);
	if (scenario === undefined) {
		return yield* Effect.die("Missing matrix row");
	}
	const github = yield* mergedReviewGithub();
	return yield* withFleetBoard({ ...github, reviewRunning: true, ...scenario.options }, (fixture, root, source) =>
		exerciseRecoveryCase(scenario, { fixture, github, root, source }, action),
	);
}, Effect.scoped);
