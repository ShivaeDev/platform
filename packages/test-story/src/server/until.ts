import { Data, type Duration, Effect, Option, Stream } from "effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import { describeValue } from "#internal/render.ts";

export interface UntilOptions {
	readonly name: string;
	readonly timeout?: Duration.Input;
}

export class SignalNotReceived extends Data.TaggedError("SignalNotReceived")<{
	readonly message: string;
}> {}

export function until<A, E, R>(stream: Stream.Stream<A, E, R>, matches: (value: A) => boolean, options: UntilOptions) {
	return Effect.suspend(() => {
		let last = "(no values received)";
		let found: Option.Option<A> = Option.none();
		function absent(reason: string) {
			return new SignalNotReceived({
				message: `Signal "${options.name}" never arrived: ${reason}.\nLast value seen: ${last}\nhelp: Check that the action emits this signal and that the predicate matches its expected value.`,
			});
		}
		const read = stream.pipe(
			Stream.runForEachWhile((value) =>
				Effect.sync(() => {
					last = describeValue(value);
					if (!matches(value)) {
						return true;
					}
					found = Option.some(value);
					return false;
				}),
			),
			Effect.flatMap(() => (Option.isSome(found) ? Effect.succeed(found.value) : Effect.fail(absent("the stream ended")))),
		);
		const deadline = Effect.sleep(options.timeout ?? "5 seconds").pipe(
			Effect.andThen(Effect.failSync(() => absent("the live-time deadline expired"))),
			withLive,
		);
		return Effect.raceFirst(read, deadline);
	});
}

export function collectUntil<A, E, R>(stream: Stream.Stream<A, E, R>, matches: (values: readonly A[]) => boolean, options: UntilOptions) {
	return Effect.suspend(() => {
		const values: A[] = [];
		return until(
			stream.pipe(
				Stream.mapEffect((value) =>
					Effect.sync((): readonly A[] => {
						values.push(value);
						return [...values];
					}),
				),
			),
			matches,
			options,
		);
	});
}
