import { Effect } from "effect";
import { type Capture, makeCapture } from "#capture.ts";
import { type Body, effectOf } from "./body.ts";
import { type Engine, labels } from "./engine.ts";
import type { Change } from "./fakeDatabase.ts";

export function captureVerbs(engine: Engine, tell: (line: string) => void) {
	let capture: Capture<Change> | undefined;
	function read(which: "recorded" | "attempted" | "discarded") {
		return Effect.suspend(() =>
			capture === undefined
				? Effect.die(new Error("Capture a write before reading its changes"))
				: Effect.map(capture[which], (batches) => batches.map(labels)),
		);
	}
	return {
		attemptedChanges: () => read("attempted"),
		capturing: <A, E, R>(body: Body<A, E, R>) =>
			Effect.gen(function* () {
				tell("the write runs with change capture");
				capture ??= yield* makeCapture<Change>();
				return yield* Effect.provide(effectOf(body), capture.layer(engine.channel().Observer));
			}),
		discardedChanges: () => read("discarded"),
		recordedChanges: () => read("recorded"),
	};
}
