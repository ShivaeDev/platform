export interface TraitPart<TStage extends string, TApply> {
	readonly apply: TApply;
	readonly line: string;
	readonly stage: TStage;
}

export interface Trait<TStage extends string, TApply> {
	readonly parts: readonly TraitPart<TStage, TApply>[];
}
