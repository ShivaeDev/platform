import type { PersistedDraftConfig } from "@shivaedev/effect-form/persistence.ts";

export function formDraft(form: HTMLFormElement, kind: "response" | "handoff"): PersistedDraftConfig {
	return {
		key: `work-board:form:${JSON.stringify([document.documentElement.dataset.workspace ?? "", kind, form.dataset.item ?? "", form.dataset.request ?? ""])}`,
		storage: () => window.localStorage,
	};
}
