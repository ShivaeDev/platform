import { Cause, Effect } from "effect";
import { type AnyEffect, type Hook, hooked } from "#effect/internal/hooked.ts";
import type { LooseRunHooks } from "#effect/internal/runUntil.ts";
import { refusal } from "#internal/errors.ts";
import { type Narration, tellGiven } from "#internal/narration.ts";
import type { Parts } from "#internal/traits.ts";
import type { RunUntilOptions } from "#storyKit.ts";

export type LooseTrait = Parts<string, (engine: unknown) => Effect.Effect<void, unknown, unknown>>;

export interface LooseStory {
	readonly engine: unknown;
	readonly lines: readonly string[];
	readonly runUntil: (until: Hook<[engine: unknown], AnyEffect, boolean>, options?: RunUntilOptions) => Effect.Effect<void, unknown, unknown>;
	readonly tell: (line: string) => void;
}

export interface LooseDefinition {
	readonly after?: Readonly<Partial<Record<string, Hook<[engine: unknown], AnyEffect, void>>>>;
	readonly create: Hook<[], AnyEffect, unknown>;
	readonly inspect?: (engine: unknown) => unknown;
	readonly name: string;
	readonly run?: LooseRunHooks<unknown>;
	readonly stages: readonly string[];
	readonly verbs: (engine: unknown, story: LooseStory) => object;
}

export const seed = Effect.fnUntraced(function* (definition: LooseDefinition, engine: unknown, narration: Narration, given: readonly LooseTrait[]) {
	const parts = given.flatMap((each) => each.parts);
	tellGiven(narration, parts);
	for (const stage of definition.stages) {
		for (const [index, part] of parts.entries()) {
			if (part.stage === stage) {
				yield* Effect.suspend(() => part.apply(engine)).pipe(
					Effect.catchCause((cause) => {
						if (Cause.hasInterruptsOnly(cause)) {
							return Effect.interrupt;
						}
						const thrown = Cause.squash(cause);
						narration.refused = { cause: thrown, index };
						return Effect.die(refusal(definition.name, part.line, thrown));
					}),
				);
			}
		}
		const after = definition.after?.[stage];
		if (after !== undefined) {
			yield* hooked(() => after(engine));
		}
	}
});
