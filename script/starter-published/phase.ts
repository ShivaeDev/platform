import { Duration, Effect } from "effect";

export function phase<A, E, R>(name: string, work: Effect.Effect<A, E, R>) {
	return work.pipe(
		Effect.timed,
		Effect.tap(([duration]) => Effect.log(`Packed starter phase ${name}: ${(Duration.toMillis(duration) / 1000).toFixed(2)}s.`)),
		Effect.map(([, value]) => value),
	);
}
