import { Effect } from "effect";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { pendingSignal } from "./pendingSignal.ts";
import { screenAct } from "./screenAct.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenPendingWork } from "./screenSettle.ts";

export function screenRoles(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		roles: screenDriver({
			act: screenAct,
			pending: pendingSignal(engine, () => Effect.runSync(screenPendingWork(engine))()),
			root: () => document.body,
			tell,
		}),
	};
}
