import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { codexState } from "#test/codexState.ts";
import { codexVerbs } from "#test/codexVerbs.ts";
export const codex = storyKit({
	create: codexState,
	name: "Codex local adapter",
	stages: ["peer", "running"],
	verbs: (state, story) => codexVerbs(state, story.tell),
});
export const draining = codex.trait("peer", "Codex reports residual work draining", (state) => {
	state.peer.drainRejection();
});
export const lostAcknowledgement = codex.trait("peer", "Codex persists the turn but drops its acknowledgement", (state) => {
	state.peer.loseAcknowledgement();
});
export const inactiveTurn = codex.trait("peer", "Codex already has no active turn", (state) => {
	state.peer.noActiveTurn();
});
export const runningTool = codex.trait("peer", "the application tool is still running", (state) => {
	state.blockTool.value = true;
});
export function capacityRefusal(code: string) {
	return codex.trait("peer", `Codex refuses capacity with ${code}`, (state) => {
		state.peer.rejectStart(code);
	});
}
