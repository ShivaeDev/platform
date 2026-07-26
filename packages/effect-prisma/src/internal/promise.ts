import { Effect } from "effect";
import { isPrismaFailure, type PrismaError, toPrismaError } from "../error.js";

export const fromPrismaPromise = <A>(
	evaluate: (signal: AbortSignal) => PromiseLike<A>,
): Effect.Effect<A, PrismaError> =>
	Effect.tryPromise({
		try: (signal) => Promise.resolve(evaluate(signal)),
		catch: (error) => error,
	}).pipe(
		Effect.catch((error) =>
			isPrismaFailure(error)
				? Effect.fail(toPrismaError(error))
				: Effect.die(error),
		),
	);
