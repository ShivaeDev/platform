import type { Examples, Fence, Prohibition, Selector, Target } from "./model.ts";

interface Draft {
	readonly from: Selector;
	readonly name: string;
	readonly rationale: string;
}

interface Demonstrable {
	readonly demonstratedBy: (examples: Examples) => Fence;
}

interface Prohibitions {
	readonly mayImportOnly: (...subjects: readonly string[]) => { readonly of: (unit: Target) => Demonstrable };
	readonly mayNotImport: (target: Target) => Demonstrable;
	readonly mayNotReach: (target: Target) => Demonstrable;
}

function demonstrable(draft: Draft, prohibition: Prohibition): Demonstrable {
	return { demonstratedBy: (examples) => ({ _tag: "Fence", examples, from: draft.from, name: draft.name, prohibition, rationale: draft.rationale }) };
}

function prohibitions(draft: Draft): Prohibitions {
	return {
		mayImportOnly: (...subjects) => ({ of: (unit) => demonstrable(draft, { kind: "vocabulary", subjects, unit: unit.selector }) }),
		mayNotImport: (target) => demonstrable(draft, { kind: "import", to: target.selector }),
		mayNotReach: (target) => demonstrable(draft, { kind: "reach", to: target.selector }),
	};
}

export function fence(name: string): { readonly because: (rationale: string) => { readonly from: (subject: Target) => Prohibitions } } {
	return { because: (rationale) => ({ from: (subject) => prohibitions({ from: subject.selector, name, rationale }) }) };
}
