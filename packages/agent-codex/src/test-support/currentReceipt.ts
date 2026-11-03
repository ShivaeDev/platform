import type { CodexState } from "#test/codexState.ts";
export function currentReceipt(state: CodexState) {
	if (state.receipt.value === undefined) {
		throw new Error("Start a run first");
	}
	return state.receipt.value;
}
