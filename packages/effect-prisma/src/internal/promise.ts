import { Effect } from "effect";
import { isPrismaFailure, type PrismaError, toPrismaError } from "#error.ts";

export const fromPrismaPromise = <A>(evaluate: (signal: AbortSignal) => PromiseLike<A>): Effect.Effect<A, PrismaError> =>
	Effect.tryPromise({
		catch: (error) => error,
		try: (signal) => Promise.resolve(evaluate(signal)),
	}).pipe(Effect.catch((error) => (isPrismaFailure(error) ? Effect.fail(toPrismaError(error)) : Effect.die(error))));
