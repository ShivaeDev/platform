import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { pendingSignal } from "./pendingSignal.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenPendingWork } from "./screenSettle.ts";

export function screenRoles(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		roles: screenDriver({
			act: (action) => act(action),
			pending: pendingSignal(engine, () => Effect.runSync(screenPendingWork(engine))()),
			root: () => document.body,
			tell,
		}),
	};
}
