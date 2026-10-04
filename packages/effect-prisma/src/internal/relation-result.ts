import { Effect, Option } from "effect";
import type { PrismaError } from "#error.ts";
import { hasMethod, invokeMethod, isPromiseLike } from "./dynamic.ts";
import { fromPrismaPromise } from "./promise.ts";

const settle = (value: unknown, map: (result: unknown) => unknown): Effect.Effect<unknown, PrismaError> =>
	isPromiseLike(value) ? fromPrismaPromise(() => value).pipe(Effect.map(map)) : Effect.succeed(map(value));

const countOf = (result: unknown): unknown => (typeof result === "object" && result !== null ? Reflect.get(result, "count") : undefined);

export const evaluateResult = (value: unknown, terminal: PropertyKey | undefined): Effect.Effect<unknown, PrismaError> => {
	if (terminal === "count" && hasMethod(value, "aggregate")) {
		return settle(invokeMethod(value, "aggregate", [(summary: { count: () => unknown }) => ({ count: summary.count() })]), countOf);
	}

	if (terminal === "exists" && hasMethod(value, "first")) {
		return settle(invokeMethod(value, "first", []), (result) => result !== null);
	}

	const executable = hasMethod(value, "all") ? invokeMethod(value, "all", []) : value;

	if (isPromiseLike(executable)) {
		return settle(executable, (result) => (terminal === "first" ? Option.fromNullishOr(result) : result));
	}

	return Effect.succeed(executable);
};
