import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";
import { callSite } from "#server/adapters/callSite.ts";
import { type LooseDefinition, type LooseStory, type LooseTrait, seed } from "#server/adapters/seed.ts";
import type { FailureContext } from "#server/adapters/storyFailure.ts";
import { hooked } from "#server/hooked.ts";
import { narrate, narrateCreation } from "#server/narration.ts";
import { runUntil } from "#server/runUntil.ts";

type Capture = (stack: string | undefined) => Effect.Effect<string, never, unknown>;

export const start = Effect.fnUntraced(function* <A>(
	definition: LooseDefinition,
	given: readonly LooseTrait[],
	context: FailureContext,
	body: (told: { readonly story: LooseStory }) => Effect.Effect<A, unknown, unknown>,
	captures: Capture[] = [],
) {
	const engine = yield* hooked(definition.create).pipe(
		Effect.updateContext(Context.omit(Tracer.ParentSpan)),
		Effect.tapCause(() => narrateCreation(definition.name, context)),
	);
	const { narration, captureFailure } = yield* narrate({ engine, inspect: definition.inspect, name: definition.name }, context);
	const index = captures.push(captureFailure) - 1;
	function onFailure(cause: Cause.Cause<unknown>) {
		const stack = Cause.prettyErrors(cause)[0]?.stack;
		return Effect.forEach(captures, (capture) => capture(stack), { discard: true });
	}
	const bodyEffect = Effect.context<unknown>().pipe(
		Effect.flatMap((services) => {
			captures[index] = (stack) => captureFailure(stack).pipe(Effect.provideContext(services));
			const story: LooseStory = {
				apply: (traits) => seed(definition, engine, narration, traits, Effect.void, onFailure, false).pipe(Effect.provideContext(services)),
				engine,
				lines: narration.lines,
				restart: (traits) => start(definition, traits, context, Effect.succeed, captures).pipe(Effect.provideContext(services)),
				runUntil: (until, options) => {
					const site = callSite();
					narration.at = site;
					return runUntil({ engine, name: definition.name, run: definition.run, tell: (line) => narration.tellAt(line, site) }, until, options).pipe(
						Effect.provideContext(services),
					);
				},
				tell: narration.tell,
			};
			return body(
				Object.defineProperties(
					{ story },
					{
						...Object.getOwnPropertyDescriptors(definition.verbs(engine, story)),
						story: { configurable: false, enumerable: true, value: story, writable: false },
					},
				),
			);
		}),
	);
	return yield* seed(definition, engine, narration, given, bodyEffect, onFailure);
});
