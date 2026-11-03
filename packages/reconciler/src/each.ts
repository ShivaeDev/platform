import { Effect, type Fiber, type Scope } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { claimRows } from "#claimRows.ts";
import type { Reconciler } from "#Reconciler.ts";
import type { Options } from "#run.ts";
import { supervise } from "#supervise.ts";
import { watch } from "#watch.ts";

export interface EachOptions<TRow, TKey, TReadError, TReadServices, TActError, TActServices, TRecordError = never, TRecordServices = never>
	extends Omit<Options<readonly TRow[], TReadError, TReadServices, TActError, TActServices, TRecordError, TRecordServices>, "act"> {
	readonly act: (row: TRow) => Effect.Effect<unknown, TActError, TActServices>;
	readonly key: (row: TRow) => TKey;
}

export function each<TRow, TKey, TReadError, TReadServices, TActError, TActServices, TRecordError = never, TRecordServices = never>(
	options: EachOptions<TRow, TKey, TReadError, TReadServices, TActError, TActServices, TRecordError, TRecordServices>,
): Effect.Effect<
	Reconciler<TReadError | TActError | TRecordError>,
	never,
	TReadServices | TActServices | TRecordServices | Reactivity.Reactivity | Scope.Scope
> {
	return supervise(
		(pending) =>
			Effect.gen(function* () {
				const claims = new Map<TKey, { fiber?: Fiber.Fiber<unknown, TActError> }>();
				return yield* watch<readonly TRow[], TReadError | TActError, TReadServices | TActServices | Scope.Scope>(
					{
						...options,
						act: (rows, fail) => claimRows(claims, rows, options.key, options.act, fail),
					},
					pending,
				);
			}),
		options,
	);
}
