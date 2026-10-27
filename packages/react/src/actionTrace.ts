import { Effect } from "effect";

export function actionTrace<A, E, R>(effect: Effect.Effect<A, E, R>, name = "ui.action"): Effect.Effect<A, E, R> {
	return Effect.withSpan(effect, name, { root: true });
}
