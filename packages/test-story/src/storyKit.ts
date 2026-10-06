import { refused } from "#internal/refused.ts";
import { tellTraits, trait, traits } from "#internal/traits.ts";
import { type StoryLog, storyLog } from "#storyLog.ts";
import type { Trait, TraitPart } from "#trait.ts";

export type StateApply<TState> = (state: TState) => void;

export type StateTrait<TState, TStage extends string> = Trait<TStage, StateApply<TState>>;

export interface SeedOptions<TState, TStage extends string> {
	readonly after?: Partial<Record<TStage, StateApply<TState>>>;
	readonly log?: StoryLog;
}

export interface StoryKit<TState, TStage extends string> {
	readonly seed: (state: TState, given: readonly StateTrait<TState, TStage>[], options?: SeedOptions<TState, TStage>) => StoryLog;
	readonly trait: (stage: TStage, line: string, apply: StateApply<TState>) => StateTrait<TState, TStage>;
	readonly traits: (...given: readonly StateTrait<TState, TStage>[]) => StateTrait<TState, TStage>;
}

function applyOrRefuse<TState, TStage extends string>(part: TraitPart<TStage, StateApply<TState>>, state: TState): void {
	try {
		part.apply(state);
	} catch (cause) {
		throw refused(part.line, cause);
	}
}

export function storyKit<TState>() {
	return <const TStage extends string>(...stages: readonly [TStage, ...TStage[]]): StoryKit<TState, TStage> => ({
		seed: (state, given, options) => {
			const log = options?.log ?? storyLog();
			const parts = tellTraits(log, given);
			for (const stage of stages) {
				for (const part of parts.filter((each) => each.stage === stage)) {
					applyOrRefuse(part, state);
				}
				options?.after?.[stage]?.(state);
			}
			return log;
		},
		trait,
		traits,
	});
}
