import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import * as Tracer from "effect/Tracer";
import type { AnyTestLayer } from "@shivaedev/test/types.ts";
import { refusal } from "#server/internal/errors.ts";
import { type AnyEffect, type EffectHook, hooked } from "#server/internal/hooked.ts";
import { type Narration, tellGiven } from "#server/internal/narration.ts";
import type { LooseRunHooks } from "#server/internal/runUntil.ts";
import type { Parts } from "#server/internal/traits.ts";
import type { Story } from "#server/storyKit.ts";
import type { StoryClock } from "#server/storyOptions.ts";

export type LooseTrait = Parts<string, (engine: unknown) => Effect.Effect<void, unknown, unknown>>;

export type LooseStory = Story<unknown, AnyEffect, string>;

export interface LooseDefinition {
	readonly after?: Readonly<Partial<Record<string, EffectHook<[engine: unknown], AnyEffect, unknown>>>>;
	readonly around?: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, unknown, R | Scope.Scope>;
	readonly clock?: StoryClock;
	readonly create: EffectHook<[], AnyEffect, unknown>;
	readonly inspect?: (engine: unknown) => unknown;
	readonly layer?: AnyTestLayer;
	readonly name: string;
	readonly outbound?: Readonly<Record<string, string>>;
	readonly outboundPassthrough?: boolean;
	readonly run?: LooseRunHooks<unknown>;
	readonly runIf?: boolean;
	readonly stages: readonly string[];
	readonly verbs: (engine: unknown, story: LooseStory) => object;
}

export const seed = Effect.fnUntraced(function* <A>(
	definition: LooseDefinition,
	engine: unknown,
	narration: Narration,
	given: readonly LooseTrait[],
	body: Effect.Effect<A, unknown, unknown>,
	onFailure: (cause: Cause.Cause<unknown>) => Effect.Effect<unknown, never, unknown>,
	initial = true,
) {
	const parts = given.flatMap((each) => each.parts);
	const offset = narration.lines.length;
	if (initial) {
		tellGiven(narration, parts);
	} else {
		for (const part of parts) {
			narration.tellAt(part.line, part.site);
		}
	}
	const stage = Effect.fnUntraced(function* (name: string) {
		for (const [index, part] of parts.entries()) {
			if (part.stage === name) {
				yield* Effect.suspend(() => part.apply(engine)).pipe(
					Effect.catchCause((cause) => {
						if (Cause.hasInterruptsOnly(cause)) {
							return Effect.interrupt;
						}
						const thrown = Cause.squash(cause);
						narration.refused = { cause: thrown, index: offset + index };
						return Effect.die(refusal(definition.name, part.line, thrown));
					}),
				);
			}
		}
		const after = definition.after?.[name];
		if (after !== undefined) {
			return yield* hooked(() => after(engine)).pipe(Effect.updateContext(Context.omit(Tracer.ParentSpan)));
		}
		return undefined;
	});
	function remaining(index: number): Effect.Effect<A, unknown, unknown> {
		const name = definition.stages[index];
		if (name === undefined) {
			return body.pipe(Effect.tapCause(onFailure));
		}
		return stage(name).pipe(
			Effect.tapCause(onFailure),
			Effect.flatMap((services) => (Context.isContext(services) ? remaining(index + 1).pipe(Effect.provideContext(services)) : remaining(index + 1))),
		);
	}
	return yield* remaining(0);
});
