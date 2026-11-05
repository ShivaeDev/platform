import { Data, Duration, Effect, Formatter, Option } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { CatalogClock } from "#server/clocks.ts";

export interface ObserveOptions {
	readonly clock?: "live" | "test";
	readonly every?: Duration.Input;
	readonly stableReads?: number;
	readonly within?: Duration.Input;
}

export class NeverSettled<A> extends Data.TaggedError("NeverSettled")<{
	readonly reads: number;
	readonly waitingFor: string;
	readonly within: Duration.Duration;
}> {
	readonly last: Option.Option<A>;

	constructor({
		last,
		...fields
	}: { readonly last: Option.Option<A>; readonly reads: number; readonly waitingFor: string; readonly within: Duration.Duration }) {
		super(fields);
		this.last = last;
	}

	override get message() {
		const seen = Option.match(this.last, {
			onNone: () => "no read finished",
			onSome: (value) => `${this.reads} ${this.reads === 1 ? "read" : "reads"}, last value ${Formatter.format(value)}`,
		});
		return `Timed out after ${Duration.format(this.within)} waiting for ${this.waitingFor}: ${seen}`;
	}
}

// PostgreSQL announces no change to its catalog views, so this poll is the sanctioned wait for them.
export const observeUntil = Effect.fn("PostgresTest.observeUntil")(function* <A, E, R>(
	read: Effect.Effect<A, E, R>,
	settled: (value: A) => boolean,
	waitingFor: string,
	options?: ObserveOptions,
) {
	const within = Duration.fromInputUnsafe(options?.within ?? "5 seconds");
	const stableReads = options?.stableReads ?? 2;
	const clock = options?.clock === "test" ? { deadline: Effect.sleep, pause: TestClock.adjust } : yield* CatalogClock;
	const pause = clock.pause(options?.every ?? "25 millis");
	let last = Option.none<A>();
	let reads = 0;
	function observe(streak: number): Effect.Effect<A, E, R> {
		return Effect.flatMap(read, (value) => {
			last = Option.some(value);
			reads += 1;
			const agreeing = settled(value) ? streak + 1 : 0;
			return agreeing >= stableReads ? Effect.succeed(value) : Effect.andThen(pause, observe(agreeing));
		});
	}
	const deadline = clock
		.deadline(within)
		.pipe(Effect.andThen(Effect.suspend(() => Effect.fail(new NeverSettled({ last, reads, waitingFor, within })))));
	return yield* Effect.raceFirst(observe(0), deadline);
});
