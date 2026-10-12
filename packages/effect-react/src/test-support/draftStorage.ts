import { Window } from "happy-dom";
import { beforeEach, vi } from "vitest";

export function draftStorage() {
	beforeEach(({ onTestFinished }) => {
		vi.stubGlobal("localStorage", new Window({ url: "http://localhost" }).localStorage);
		onTestFinished(() => {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
			vi.useRealTimers();
		});
	});
}
