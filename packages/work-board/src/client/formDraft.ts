import type { PersistedDraftConfig } from "@shivaedev/effect-form/persistence.ts";

export function formDraft(kind: "response" | "handoff", item: string, request = ""): PersistedDraftConfig {
	const workspace = typeof document === "undefined" ? "" : (document.documentElement.dataset.workspace ?? "");
	return {
		key: `work-board:form:${JSON.stringify([workspace, kind, item, request])}`,
		storage: () => window.localStorage,
	};
}
