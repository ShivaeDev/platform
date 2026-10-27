import { Layer } from "effect";
import type { AnyTestLayer } from "@shivaedev/test/anyTestLayer.ts";
import { type KitList, kitDefinition } from "#internal/compositionTypes.ts";
import { hooked } from "#internal/hooked.ts";
import { runUntil } from "#internal/runUntil.ts";
import type { LooseDefinition } from "#internal/seed.ts";

export function compose(name: string, kits: KitList): LooseDefinition {
	const definitions = kits.map((kit) => kit[kitDefinition]);
	const around = definitions.reduceRight<NonNullable<LooseDefinition["around"]>>(
		(wrap, definition) => (effect) => definition.around?.(wrap(effect)) ?? wrap(effect),
		(effect) => effect,
	);
	return {
		after: Object.assign({}, ...definitions.map((definition) => definition.after)),
		around,
		clock: definitions.find((definition) => definition.clock !== undefined)?.clock ?? "test",
		*create() {
			const engine = {};
			for (const definition of definitions) {
				Object.defineProperties(engine, Object.getOwnPropertyDescriptors(yield* hooked(definition.create)));
			}
			return engine;
		},
		inspect: (engine) =>
			Object.fromEntries(definitions.map((definition) => [definition.name, definition.inspect === undefined ? engine : definition.inspect(engine)])),
		layer: definitions.reduce<AnyTestLayer>((layer, definition) => Layer.merge(layer, definition.layer ?? Layer.empty), Layer.empty),
		name,
		outbound: Object.assign({}, ...definitions.map((definition) => definition.outbound)),
		runIf: definitions.every((definition) => definition.runIf !== false),
		stages: definitions.flatMap((definition) => definition.stages),
		verbs: (engine, story) => {
			const verbs = {};
			for (const definition of definitions) {
				const featureStory = {
					...story,
					runUntil: (until: Parameters<typeof story.runUntil>[0], options: Parameters<typeof story.runUntil>[1]) =>
						runUntil({ engine, name: definition.name, run: definition.run, tell: story.tell }, until, options),
				};
				Object.defineProperties(verbs, Object.getOwnPropertyDescriptors(definition.verbs(engine, featureStory)));
			}
			return verbs;
		},
	};
}
