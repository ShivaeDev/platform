import type { EngineOptions } from "#test/EngineOptions.ts";

export function changedSecondBriefConfiguration() {
	return (): EngineOptions => ({ mainChanges: ["src/two.ts"] });
}
