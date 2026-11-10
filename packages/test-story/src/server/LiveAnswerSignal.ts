import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";

export interface LiveAnswerSignal {
	readonly answered: Stream.Stream<number>;
	readonly current: Effect.Effect<number>;
	readonly name: string;
}
