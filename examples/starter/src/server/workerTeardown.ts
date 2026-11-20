import { Cause, Exit, Runtime } from "effect";

export const workerTeardown: Runtime.Teardown = (exit, onExit) => {
	if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
		onExit(0);
	} else {
		Runtime.defaultTeardown(exit, onExit);
	}
};
