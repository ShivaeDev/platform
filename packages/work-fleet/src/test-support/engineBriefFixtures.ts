import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";

export const LINKED_GOAL = "---\nid: goal.example\nkind: goal\n---\n# Example goal\n\n| Lane | Work |\n| --- | --- |\n";
export function linkedBrief(source: string) {
	return source.replace("kind: task\n", "kind: task\nrelationships:\n  - kind: implements\n    target: goal.example\n");
}
export function bookkeepingBrief(source: string) {
	return source.replace("kind: task", "kind: task\nstatus: draft\nnext_action: Implement the work.\nowner: codex");
}
export function criteriaBrief(source: string) {
	return source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
}
export function briefAtPhase(phase: string, brief: (source: string) => string, wholeFileRevision = false) {
	return engine.trait("work", `the brief is already in ${phase}`, function* (state) {
		boardHttpFiles(state.root).write("one.md", brief(state.source));
		yield* prepareBookkeepingPhase(running(state).fixture, phase, wholeFileRevision).pipe(Effect.provideService(Fleet, running(state).fleet));
	});
}
export function priorityTask(id: string, priority: string) {
	return `---\nid: ${id}\nkind: task\nfleet: approved\nfleet-priority: ${priority}\n---\n# Work ${id}\n`;
}

export function noChangeDuringBriefPhase(phase: string) {
	return engineConfiguration("workers report no repository change", () => ({ noChange: true, reviewRunning: phase === "review" }));
}
