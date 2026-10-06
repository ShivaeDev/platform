import { callSite } from "#internal/callSite.ts";

export interface TraitPart<TStage extends string, TApply> {
	readonly apply: TApply;
	readonly line: string;
	readonly site: Error;
	readonly stage: TStage;
}

export interface Parts<TStage extends string, TApply> {
	readonly parts: readonly TraitPart<TStage, TApply>[];
}

export function trait<TStage extends string, TApply>(stage: TStage, line: string, apply: TApply): Parts<TStage, TApply> {
	return { parts: [{ apply, line, site: callSite(), stage }] };
}

export function traits<TStage extends string, TApply>(...given: readonly Parts<TStage, TApply>[]): Parts<TStage, TApply> {
	return { parts: given.flatMap((each) => each.parts) };
}
