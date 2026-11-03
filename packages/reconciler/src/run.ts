import type { Effect, Scope } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { Due, Reconciler } from "#Reconciler.ts";
import { type FailureHandler, supervise } from "#supervise.ts";
import { watch } from "#watch.ts";

export interface Options<TValue, TReadError, TReadServices, TActError, TActServices, TRecordError = never, TRecordServices = never>
	extends FailureHandler<TReadError | TActError, TRecordError, TRecordServices> {
	readonly act: (value: TValue) => Effect.Effect<unknown, TActError, TActServices>;
	readonly due?: Due<TValue>;
	readonly keys: readonly Key[];
	readonly read: Effect.Effect<TValue, TReadError, TReadServices>;
}

export function run<TValue, TReadError, TReadServices, TActError, TActServices, TRecordError = never, TRecordServices = never>(
	options: Options<TValue, TReadError, TReadServices, TActError, TActServices, TRecordError, TRecordServices>,
): Effect.Effect<
	Reconciler<TReadError | TActError | TRecordError>,
	never,
	TReadServices | TActServices | TRecordServices | Reactivity.Reactivity | Scope.Scope
> {
	return supervise((pending) => watch<TValue, TReadError | TActError, TReadServices | TActServices>(options, pending), options);
}
