import { Effect } from "effect";
import { type PrismaError, toPrismaError } from "../error.js";
import type { DatabaseExecutor } from "./executor.js";

export const executeQuery = <A, E, R>(
	executor: Pick<DatabaseExecutor<object>, "liveness" | "querySemaphore">,
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PrismaError, R> => {
	if (!executor.liveness.open) {
		return Effect.fail(toPrismaError({ code: executor.liveness.closedCode }));
	}
	return executor.querySemaphore === undefined
		? effect
		: executor.querySemaphore.withPermit(Effect.uninterruptible(effect));
};
