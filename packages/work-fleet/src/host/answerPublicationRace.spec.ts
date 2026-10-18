import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { dispatchApproved } from "#host/admission.ts";
import { answerWork } from "#host/answerWork.ts";
import { hostLayer } from "#host/commands.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import { finishWorkers } from "#test/engine.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");
const TEXT = "Keep the review feedback in the next turn.";

for (const stage of ["repairing", "executing"] as const) {
	for (const input of ["text", "empty", "release"] as const) {
		test(`answer ${input} handles a move to ${stage} before decision publication reloads`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
				publicationStory(fixture, stage, input).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)), Effect.scoped),
			));
	}
}

const publicationStory = Effect.fn("AnswerPublicationRaceTest.publicationStory")(function* (
	fixture: HostFixture,
	stage: "repairing" | "executing",
	input: "text" | "empty" | "release",
) {
	const fleet = yield* Fleet;
	yield* dispatchApproved(fixture.host, "one");
	finishWorkers(fixture.provider);
	const waiting = yield* fleet.reconcile("one");
	expect(waiting.value.stage).toBe("needs-human");
	let publications = 0;
	const racing = {
		...fleet,
		publishDecision: (workId: string) =>
			Effect.gen(function* () {
				publications += 1;
				yield* storeState(fixture.host, workId, { ...waiting.value, decision: undefined, stage });
				return yield* fleet.publishDecision(workId);
			}),
	};
	const result = yield* withDecisionResponses(
		fixture.host,
		answerWork(fixture.host, "one", { release: input === "release", text: input === "empty" ? "  " : TEXT }),
	).pipe(Effect.provideService(Fleet, racing), Effect.result);
	expect(publications).toBe(1);
	const current = yield* fleet.get("one");
	if (input !== "text") {
		expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "Conflict", message: `Decision changed: ${stage}` } });
		expect(current.value.pendingAnswers).toBeUndefined();
		return;
	}
	expect(result).toMatchObject({ _tag: "Success", success: { value: { pendingAnswers: [TEXT], stage } } });
	expect(current.value.pendingAnswers).toEqual([TEXT]);
	const next = yield* fleet.reconcile("one");
	expect(next.value.attempts.at(-1)?.prompt).toContain(TEXT);
	expect(next.value.pendingAnswers).toBeUndefined();
});
