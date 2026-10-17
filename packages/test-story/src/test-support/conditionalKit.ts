import { Effect, Layer } from "effect";
import { storyKit } from "#storyKit.ts";

export function conditionalKit(runIf: boolean) {
	const executed: string[] = [];
	const kit = storyKit({
		around: (effect) => Effect.sync(() => executed.push("around")).pipe(Effect.andThen(effect)),
		create: () => {
			executed.push("create");
			return {};
		},
		layer: Layer.effectDiscard(Effect.sync(() => executed.push("layer"))),
		name: "bakery",
		runIf,
		stages: ["pantry"],
		verbs: () => ({
			recordsBody: (): undefined => {
				executed.push("body");
			},
		}),
	});
	const given = [
		kit.trait("pantry", "records setup", () => {
			executed.push("trait");
		}),
	];
	return { executed, given, kit };
}
