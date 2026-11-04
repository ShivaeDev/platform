import { Clock, DateTime, Effect } from "effect";
import { storyKit } from "#server/storyKit.ts";
import { noteLifetime, recordLifetime } from "./lifetimeLog.ts";

export const lifetime = storyKit({
	after: {
		*built() {
			yield* recordLifetime("after");
		},
	},
	around: (effect) => noteLifetime("enter").pipe(Effect.andThen(effect), Effect.ensuring(noteLifetime("exit"))),
	clock: DateTime.makeUnsafe("2026-10-17T12:34:56.000Z"),
	*create() {
		yield* recordLifetime("engine");
		return {};
	},
	name: "lifetime",
	stages: ["built"],
	verbs: () => ({
		clock: () => Clock.currentTimeMillis.pipe(Effect.map((millis) => (millis === 0 ? "the test clock at zero" : "the pinned clock"))),
		recordsBody: () => noteLifetime("body"),
	}),
});

export const resource = lifetime.trait("built", "a scoped resource is acquired", function* () {
	yield* recordLifetime("trait");
});
