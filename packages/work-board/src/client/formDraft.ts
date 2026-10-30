import type { PersistedDraftConfig } from "@shivaedev/form/persistence.ts";

export function formDraft(now: () => number, kind: "response" | "handoff", item: string, request = ""): PersistedDraftConfig {
	const workspace = typeof document === "undefined" ? "" : (document.documentElement.dataset.workspace ?? "");
	return {
		key: `work-board:form:${JSON.stringify([workspace, kind, item, request])}`,
		now,
		storage: () => window.localStorage,
	};
}
