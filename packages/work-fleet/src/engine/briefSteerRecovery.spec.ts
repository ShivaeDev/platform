import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { taskPrompt } from "#prompt/task.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { pausedSteer } from "#test/engineTimingTraits.ts";
import { markdownWork, reviewerStillRunning, reviewRequestsRepairs } from "#test/engineTraits.ts";
import { providerWithoutSteeringConfiguration } from "#test/providerWithoutSteeringConfiguration.ts";

const providerWithoutSteering = engineConfiguration("provider without steering", providerWithoutSteeringConfiguration());

isolatedEngine.it(
	"an interrupted steer keeps its durable intent and revised review without replay",
	[markdownWork(), pausedSteer(false, true)],
	function* ({ boardBrief, writeBoardWork, steerCalls, waitForTimingGate, finishWorkers, prepareWork, restart, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const current = `${source}\nChanged scope.\n`;
		writeBoardWork("one.md", current);
		const approving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
		yield* waitForTimingGate();
		yield* Fiber.interrupt(approving);
		const pending = yield* fleet.get("one");
		expect(pending.value.boardContext).toBe(current);
		expect(pending.value.attempts[0]?.briefSteers).toEqual([{ requestedAt: 100, revision: pending.value.boardRevision }]);
		expect(renderStatus(views([pending.value]))).toContain("delivery unconfirmed");
		yield* restart();
		yield* Effect.suspend(() => fleet.reconcile("one"));
		expect(steerCalls()).toBe(1);
		finishWorkers();
		const review = yield* fleet.reconcile("one");
		expect(review.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
	},
);

engine.it(
	"a provider without steering records the failure and keeps revised review",
	[markdownWork(), providerWithoutSteering],
	function* ({ boardBrief, writeBoardWork, finishWorkers, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const current = `${source}\nChanged scope.\n`;
		writeBoardWork("one.md", current);
		const approved = yield* fleet.reconcile("one");
		expect(approved.value.step).toBe("working");
		expect(renderStatus(views([approved.value]))).toContain("failed: Provider does not support steering");
		finishWorkers();
		const review = yield* fleet.reconcile("one");
		expect(review.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
	},
);

engine.it(
	"a repair turn can receive a revision already steered into its worker turn",
	[markdownWork(), engine.traits(reviewRequestsRepairs(), reviewerStillRunning())],
	function* ({ boardBrief, writeBoardWork, steeredTurns, finishWorkers, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		const worker = yield* fleet.dispatch("one");
		const current = `${source}\nRevised scope.\n`;
		writeBoardWork("one.md", current);
		yield* fleet.reconcile("one");
		writeBoardWork("one.md", source);
		yield* fleet.reconcile("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		finishWorkers();
		const repair = yield* fleet.reconcile("one");
		expect(repair.value.attempts.at(-1)?.role).toBe("repair");
		writeBoardWork("one.md", current);
		const revised = yield* fleet.reconcile("one");
		expect(steeredTurns()).toHaveLength(3);
		expect(steeredTurns().at(-1)?.receipt).toEqual(repair.value.attempts.at(-1)?.receipt);
		expect(steeredTurns().at(-1)?.receipt.turnId).not.toBe(worker.value.attempts[0]?.receipt?.turnId);
		expect(revised.value.attempts.at(-1)?.briefSteers).toHaveLength(1);
	},
);

engine.it(
	"an edit observed after worker completion reaches review without steering the done turn",
	[markdownWork(), reviewerStillRunning()],
	function* ({ boardBrief, writeBoardWork, steeredTurns, finishWorkers, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const current = `${source}\nRevised scope.\n`;
		writeBoardWork("one.md", current);
		const reviewed = yield* fleet.reconcile("one");
		expect(steeredTurns()).toEqual([]);
		expect(reviewed.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
	},
);
