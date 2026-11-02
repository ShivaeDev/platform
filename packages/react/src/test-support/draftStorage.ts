import { Effect } from "effect";
import { beforeEach, vi } from "vitest";
import { browserDraftStorage } from "@shivaedev/form/adapters/browserDraftStorage.ts";
import { draftPersistence } from "@shivaedev/form/adapters/draftPersistence.ts";

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

export const browserPersistence = draftPersistence.pipe(Effect.provide(browserDraftStorage));
