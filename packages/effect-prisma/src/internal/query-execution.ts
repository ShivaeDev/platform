import { Effect } from "effect";
import { type PrismaError, toPrismaError } from "../error.ts";
import type { DatabaseExecutor } from "./executor.ts";

export const executeQuery = <A, E, R>(
	executor: Pick<DatabaseExecutor<object>, "liveness" | "querySemaphore">,
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PrismaError, R> => {
	const checked = Effect.suspend(
		(): Effect.Effect<A, E | PrismaError, R> =>
			executor.liveness.open ? effect : Effect.fail(toPrismaError({ code: executor.liveness.closedCode })),
	);
	return executor.querySemaphore === undefined ? checked : executor.querySemaphore.withPermit(Effect.uninterruptible(checked));
};
