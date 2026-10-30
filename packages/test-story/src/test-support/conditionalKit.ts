import { Effect, Layer } from "effect";
import { storyKit } from "#storyKit.ts";
import { noteLifetime } from "./lifetimeLog.ts";

export function conditionalKit(runIf: boolean) {
	const kit = storyKit({
		around: (effect) => noteLifetime("around").pipe(Effect.andThen(effect)),
		*create() {
			yield* noteLifetime("create");
			return {};
		},
		layer: Layer.effectDiscard(noteLifetime("layer")),
		name: "bakery",
		runIf,
		stages: ["pantry"],
		verbs: () => ({ recordsBody: () => noteLifetime("body") }),
	});
	const given = [kit.trait("pantry", "records setup", () => noteLifetime("trait"))];
	return { given, kit };
}
