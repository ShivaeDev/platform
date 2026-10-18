import { beforeEach, vi } from "vitest";

export function draftStorage() {
	beforeEach(({ onTestFinished }) => {
		const storage = window.localStorage;
		storage.clear();
		vi.stubGlobal("localStorage", storage);
		onTestFinished(() => {
			storage.clear();
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
			vi.useRealTimers();
		});
	});
}
