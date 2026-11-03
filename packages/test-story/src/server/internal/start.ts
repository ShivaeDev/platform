import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";
import type { TestContext } from "vitest";
import { callSite } from "#server/internal/callSite.ts";
import { hooked } from "#server/internal/hooked.ts";
import { narrate, narrateCreation } from "#server/internal/narration.ts";
import { runUntil } from "#server/internal/runUntil.ts";
import { type LooseDefinition, type LooseStory, type LooseTrait, seed } from "#server/internal/seed.ts";

export const start = Effect.fnUntraced(function* (
	definition: LooseDefinition,
	given: readonly LooseTrait[],
	context: TestContext,
	body: (told: object) => Effect.Effect<unknown, unknown, unknown>,
) {
	const engine = yield* hooked(definition.create).pipe(
		Effect.updateContext(Context.omit(Tracer.ParentSpan)),
		Effect.tapCause(() => narrateCreation(definition.name, context)),
	);
	const { narration, captureFailure } = yield* narrate({ engine, inspect: definition.inspect, name: definition.name }, context);
	const bodyEffect = Effect.suspend(() => {
		const story: LooseStory = {
			engine,
			lines: narration.lines,
			runUntil: (until, options) => {
				const site = callSite();
				narration.at = site;
				return runUntil({ engine, name: definition.name, run: definition.run, tell: (line) => narration.tellAt(line, site) }, until, options);
			},
			tell: narration.tell,
		};
		return body(
			Object.defineProperties(
				{},
				{
					...Object.getOwnPropertyDescriptors(definition.verbs(engine, story)),
					story: { enumerable: true, value: story },
				},
			),
		);
	});
	return yield* seed(definition, engine, narration, given, bodyEffect, (cause) => captureFailure(Cause.prettyErrors(cause)[0]?.stack));
});
