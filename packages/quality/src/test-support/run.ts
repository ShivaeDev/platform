import { Effect, type Scope } from "effect";
import { services } from "#cli/runMain.ts";
import type { RuleServices } from "#rule.ts";

export function run<TValue, TError>(effect: Effect.Effect<TValue, TError, RuleServices | Scope.Scope>): Promise<TValue> {
	return Effect.runPromise(Effect.scoped(effect).pipe(Effect.provide(services)));
}
