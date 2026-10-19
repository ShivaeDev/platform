import { Option } from "effect";
import type { SaveState } from "@shivaedev/effect-react/client/saveState.ts";
import { type SaveFailure, saveFailure } from "./saveFailure.ts";

export type DraftInteraction = "draft" | "cleared" | "submitted";
export function formStatus<A>(
	state: Pick<SaveState<SaveFailure>, "saving" | "failure"> & { readonly created: Option.Option<A> },
	interaction: DraftInteraction,
	kind: "response" | "handoff",
	saved: (value: A) => string,
): { readonly outcome: string | undefined; readonly text: string } {
	if (state.saving) {
		return {
			outcome: "pending",
			text: kind === "response" ? "Saving your answer…" : "Saving the handoff file…",
		};
	}
	if (interaction === "submitted") {
		if (Option.isSome(state.failure)) {
			return saveFailure(state.failure.value, kind);
		}
		if (Option.isSome(state.created)) {
			return { outcome: "saved", text: saved(state.created.value) };
		}
	}
	const ready = kind === "handoff" ? "Preview the file, then prepare the handoff." : "";
	return {
		outcome: undefined,
		text: interaction === "cleared" ? `Draft cleared. Saved ${kind === "response" ? "responses" : "handoffs"} are unchanged.` : ready,
	};
}

export function responseSaved(id: string, dirty: boolean, choice = "") {
	return `Answer saved${choice ? `: “${choice}”` : ""}. The agent reads it from responses/${id}.md the next time it checks. This records your answer, not acceptance of the work.${dirty ? " Your current draft remains unsaved." : ""}`;
}
