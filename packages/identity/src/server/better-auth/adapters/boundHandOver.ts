import { Context, Effect } from "effect";

// The hand-over's services come from where the application registered it, and the deletion's fiber adds its open transaction on
// top, so the hand-over's SQL joins the deletion's commit. Its failure is the application's own and is reported, not answered.
export const boundHandOver = Effect.fnUntraced(function* <E, R>(handOver: ((userId: string) => Effect.Effect<void, E, R>) | undefined) {
	const registered = yield* Effect.context<R>();
	return (userId: string): Effect.Effect<void> =>
		handOver === undefined
			? Effect.void
			: Effect.withFiber((fiber) => Effect.provideContext(Effect.orDie(handOver(userId)), Context.merge(registered, fiber.context)));
});
