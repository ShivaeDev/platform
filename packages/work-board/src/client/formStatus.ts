import { Option } from "effect";
import type { SaveState } from "@shivaedev/effect-react/save-state.ts";
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
			text: kind === "response" ? "Pending: registering reviewed context, then recording response…" : "Pending: preparing the local handoff file…",
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
	const ready = kind === "handoff" ? "Draft ready. Review and preview before preparing the file." : "";
	return {
		outcome: undefined,
		text: interaction === "cleared" ? `Draft cleared. Saved ${kind === "response" ? "responses" : "handoffs"} are unchanged.` : ready,
	};
}

export function responseSaved(id: string, dirty: boolean) {
	return `Saved: responses/${id}.md. This records feedback, not acceptance.${dirty ? " Your current draft remains unsaved." : ""}`;
}
