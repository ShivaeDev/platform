import type { StoryLog } from "#storyLog.ts";

export interface TraitPart<TStage extends string, TApply> {
	readonly apply: TApply;
	readonly line: string;
	readonly stage: TStage;
}

export interface Trait<TStage extends string, TApply> {
	readonly parts: readonly TraitPart<TStage, TApply>[];
}

export function trait<TStage extends string, TApply>(stage: TStage, line: string, apply: TApply): Trait<TStage, TApply> {
	return { parts: [{ apply, line, stage }] };
}

export function traits<TStage extends string, TApply>(...given: readonly Trait<TStage, TApply>[]): Trait<TStage, TApply> {
	return { parts: given.flatMap((each) => each.parts) };
}

export function tellTraits<TStage extends string, TApply>(
	log: StoryLog,
	given: readonly Trait<TStage, TApply>[],
): readonly TraitPart<TStage, TApply>[] {
	const parts = given.flatMap((each) => each.parts);
	for (const part of parts) {
		log.tell(part.line);
	}
	return parts;
}

export function refused(line: string, cause: unknown): Error {
	return new Error(`trait "${line}" refused: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
}
