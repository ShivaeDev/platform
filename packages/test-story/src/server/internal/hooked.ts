import { Effect } from "effect";

export type AnyEffect = Effect.Effect<unknown, unknown, unknown>;

export type Hook<TArguments extends readonly unknown[], TEffect extends AnyEffect, A> = (...input: TArguments) => Generator<TEffect, A, never> | A;

export type ErrorOf<TEffect> = [TEffect] extends [never] ? never : [TEffect] extends [Effect.Effect<infer _A, infer E, infer _R>] ? E : never;

export type ServicesOf<TEffect> = [TEffect] extends [never] ? never : [TEffect] extends [Effect.Effect<infer _A, infer _E, infer R>] ? R : never;

function isGenerator<TEffect, A>(value: Generator<TEffect, A, never> | A): value is Generator<TEffect, A, never> {
	return typeof value === "object" && value !== null && Symbol.iterator in value && "next" in value && typeof value.next === "function";
}

export function hooked<TEffect extends AnyEffect, A>(
	call: () => Generator<TEffect, A, never> | A,
): Effect.Effect<A, ErrorOf<TEffect>, ServicesOf<TEffect>> {
	return Effect.suspend(() => {
		const result = call();
		return isGenerator(result) ? Effect.gen(() => result) : Effect.succeed(result);
	});
}
