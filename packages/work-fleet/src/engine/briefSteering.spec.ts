import { expect } from "@effect/vitest";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { taskPrompt } from "#prompt/task.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { observableBriefSteering } from "#test/observableBriefSteering.ts";

for (const failure of [false, true]) {
	{
		const calls: { receipt: { sessionId: string; turnId: string }; prompt: string }[] = [];
		const observableBriefSteeringTrait = engineConfiguration(
			"observable brief steering",
			observableBriefSteering({
				failure: () => failure,
				recordSteer: (receipt, prompt) => {
					calls.push({ prompt, receipt });
				},
			}),
		);
		engine.it(
			`approved edits steer once per running turn and retain revised review after restart: failure=${failure}`,
			[markdownWork(), observableBriefSteeringTrait],
			function* ({ boardBrief, writeBoardWork, steeredTurns, finishWorkers, prepareWork, restart, fleet }) {
				const source = boardBrief();
				const original = source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
				const current = original.replace("Original behavior.", "Changed behavior.");
				writeBoardWork("one.md", original);
				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				writeBoardWork("one.md", current);
				const approved = yield* fleet.reconcile("one");
				expect(approved.value).toMatchObject({ boardContext: current, prompt: current, step: "working" });
				expect(approved.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
				expect(approved.value.attempts[0]?.briefSteers).toEqual([
					expect.objectContaining(failure ? { error: "Steer unavailable" } : { steeredAt: 100 }),
				]);
				expect(renderStatus(views([approved.value]))).toContain(
					failure ? "failed: Steer unavailable" : "brief edit steered 1970-01-01T00:00:00.100Z",
				);
				if (!failure) {
					expect(steeredTurns()).toEqual([
						{
							prompt: expect.stringContaining("Criterion behavior: Original behavior. -> Changed behavior."),
							receipt: worker.value.attempts[0]?.receipt,
						},
					]);
					expect(steeredTurns()[0]?.prompt).toContain(`Full new brief:\n\n${current}`);
				}
				yield* restart();
				yield* fleet.reconcile("one");
				yield* fleet.reconcile("one");
				expect(calls).toMatchObject([{ prompt: expect.stringContaining(current), receipt: worker.value.attempts[0]?.receipt }]);
				writeBoardWork("one.md", original);
				yield* fleet.reconcile("one");
				writeBoardWork("one.md", current);
				yield* fleet.reconcile("one");
				expect(calls).toMatchObject([
					{ prompt: expect.stringContaining(current), receipt: worker.value.attempts[0]?.receipt },
					{ prompt: expect.stringContaining(original), receipt: worker.value.attempts[0]?.receipt },
				]);
				finishWorkers();
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.step).toBe("reviewing");
				expect(reviewing.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
				writeBoardWork("one.md", `${current}\nChanged during review.\n`);
				yield* fleet.reconcile("one");
				expect(calls).toMatchObject([
					{ prompt: expect.stringContaining(current), receipt: worker.value.attempts[0]?.receipt },
					{ prompt: expect.stringContaining(original), receipt: worker.value.attempts[0]?.receipt },
				]);
			},
		);
	}
}
