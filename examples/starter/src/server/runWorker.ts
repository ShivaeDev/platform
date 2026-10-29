import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Cause, Exit, Runtime } from "effect";

export const runWorker = NodeRuntime.runMain({
	teardown: (exit, onExit) => {
		if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
			onExit(0);
		} else {
			Runtime.defaultTeardown(exit, onExit);
		}
	},
});
