import { broken, cannotRun, refusal, unfinished } from "#internal/errors.ts";
import { type Narration, narrate, tellGiven } from "#internal/narration.ts";
import { type Parts, trait, traits } from "#internal/traits.ts";

export type Apply<TEngine> = (engine: TEngine) => void;

export type Trait<TEngine, TStage extends string> = Parts<TStage, Apply<TEngine>>;

export interface RunUntilOptions {
	readonly maxSteps?: number | undefined;
}

export interface Story<TEngine> {
	readonly engine: TEngine;
	readonly lines: readonly string[];
	readonly runUntil: (until: (engine: TEngine) => boolean, options?: RunUntilOptions) => void;
	readonly tell: (line: string) => void;
}

export interface RunHooks<TEngine> {
	readonly diagnose?: (engine: TEngine) => string;
	readonly failed?: (engine: TEngine) => string | undefined;
	readonly maxSteps: number;
	readonly step: (engine: TEngine, tell: (line: string) => void) => void;
}

export interface StoryKitDefinition<TEngine, TStage extends string, TVerbs> {
	readonly after?: { readonly [TKey in TStage]?: Apply<TEngine> };
	readonly create: () => TEngine;
	readonly inspect?: (engine: TEngine) => unknown;
	readonly name: string;
	readonly run?: RunHooks<TEngine>;
	readonly stages: readonly [TStage, ...TStage[]];
	readonly verbs: (engine: TEngine, story: Story<TEngine>) => TVerbs;
}

export interface StoryKit<TEngine, TStage extends string, TVerbs> {
	readonly start: (...given: readonly Trait<TEngine, TStage>[]) => TVerbs & { readonly story: Story<TEngine> };
	readonly trait: (stage: TStage, line: string, apply: Apply<TEngine>) => Trait<TEngine, TStage>;
	readonly traits: (...given: readonly Trait<TEngine, TStage>[]) => Trait<TEngine, TStage>;
}

function runUntil<TEngine>(
	name: string,
	run: RunHooks<TEngine> | undefined,
	story: Story<TEngine>,
	until: (engine: TEngine) => boolean,
	options?: RunUntilOptions,
): void {
	if (run === undefined) {
		throw cannotRun(name);
	}
	const maxSteps = options?.maxSteps ?? run.maxSteps;
	for (let steps = 0; ; steps += 1) {
		const reason = run.failed?.(story.engine);
		if (reason !== undefined) {
			throw broken(name, steps, reason);
		}
		if (until(story.engine)) {
			return;
		}
		if (steps >= maxSteps) {
			throw unfinished(name, steps, run.diagnose?.(story.engine));
		}
		run.step(story.engine, story.tell);
	}
}

function seed<TEngine, TStage extends string>(
	definition: StoryKitDefinition<TEngine, TStage, unknown>,
	engine: TEngine,
	narration: Narration,
	given: readonly Trait<TEngine, TStage>[],
): void {
	const parts = given.flatMap((each) => each.parts);
	tellGiven(narration, parts);
	for (const stage of definition.stages) {
		for (const [index, part] of parts.entries()) {
			if (part.stage !== stage) {
				continue;
			}
			try {
				part.apply(engine);
			} catch (cause) {
				narration.refused = { cause, index };
				throw refusal(definition.name, part.line, cause);
			}
		}
		definition.after?.[stage]?.(engine);
	}
}

export function storyKit<TEngine, const TStage extends string, TVerbs extends object>(
	definition: StoryKitDefinition<TEngine, TStage, TVerbs>,
): StoryKit<TEngine, TStage, TVerbs> {
	return {
		start: (...given) => {
			const engine = definition.create();
			const narration = narrate({ engine, inspect: definition.inspect, name: definition.name });
			seed(definition, engine, narration, given);
			const story: Story<TEngine> = {
				engine,
				lines: narration.lines,
				runUntil: (until, options) => runUntil(definition.name, definition.run, story, until, options),
				tell: narration.tell,
			};
			return { ...definition.verbs(engine, story), story };
		},
		trait,
		traits,
	};
}
