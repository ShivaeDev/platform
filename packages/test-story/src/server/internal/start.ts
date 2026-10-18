import { Cause, Context, Effect, Tracer } from "effect";
import type { TestContext } from "vitest";
import { callSite } from "#internal/callSite.ts";
import { hooked } from "#internal/hooked.ts";
import { narrate } from "#internal/narration.ts";
import { runUntil } from "#internal/runUntil.ts";
import { type LooseDefinition, type LooseStory, type LooseTrait, seed } from "#internal/seed.ts";

export const start = Effect.fnUntraced(function* (
	definition: LooseDefinition,
	given: readonly LooseTrait[],
	context: TestContext,
	body: (told: object) => Effect.Effect<unknown, unknown, unknown>,
) {
	const engine = yield* hooked(definition.create).pipe(Effect.updateContext(Context.omit(Tracer.ParentSpan)));
	const { narration, captureFailure } = narrate({ engine, inspect: definition.inspect, name: definition.name }, context);
	return yield* Effect.gen(function* () {
		yield* seed(definition, engine, narration, given);
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
		// Copying descriptors keeps verb getters lazy, so a story evaluates only the verbs it reads.
		const told = Object.defineProperties({}, Object.getOwnPropertyDescriptors(definition.verbs(engine, story)));
		return yield* body(Object.defineProperty(told, "story", { enumerable: true, value: story }));
	}).pipe(Effect.tapCause((cause) => Effect.sync(() => captureFailure(Cause.prettyErrors(cause)[0]?.stack))));
});
