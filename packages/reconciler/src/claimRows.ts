import { Cause, Effect, Exit, Fiber } from "effect";

type Claims<TKey, E> = Map<TKey, { fiber?: Fiber.Fiber<unknown, E> }>;

const releaseAbsent = Effect.fnUntraced(function* <TKey, E>(claims: Claims<TKey, E>, matching: ReadonlySet<TKey>) {
	for (const [key, claim] of claims) {
		if (matching.has(key)) {
			continue;
		}
		claims.delete(key);
		if (claim.fiber !== undefined) {
			yield* Fiber.interrupt(claim.fiber);
		}
	}
});

export const claimRows = Effect.fnUntraced(function* <TRow, TKey, E, R>(
	claims: Claims<TKey, E>,
	rows: readonly TRow[],
	keyOf: (row: TRow) => TKey,
	act: (row: TRow) => Effect.Effect<unknown, E, R>,
	fail: (cause: Cause.Cause<E>) => Effect.Effect<unknown>,
) {
	yield* releaseAbsent(claims, new Set(rows.map(keyOf)));
	for (const row of rows) {
		const key = keyOf(row);
		if (claims.has(key)) {
			continue;
		}
		const claim: { fiber?: Fiber.Fiber<unknown, E> } = {};
		claims.set(key, claim);
		claim.fiber = yield* Effect.forkScoped(
			Effect.scoped(Effect.suspend(() => act(row))).pipe(
				Effect.onExit((exit) => {
					if (Exit.isSuccess(exit)) {
						return Effect.void;
					}
					claims.delete(key);
					return Cause.hasInterruptsOnly(exit.cause) ? Effect.void : fail(exit.cause);
				}),
			),
		);
	}
});
