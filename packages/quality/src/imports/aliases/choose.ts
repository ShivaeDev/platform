import { type Located, loadsOnly } from "./forward.ts";
import { captured, filled, type Mapping } from "./pattern.ts";

export type AliasKind = "imports" | "package";

export interface AliasScope {
	readonly crossing: boolean;
	readonly exported: readonly Mapping[];
	readonly imports: readonly Mapping[];
	readonly own: Located | undefined;
	readonly owner: Located | undefined;
}

interface Candidate {
	readonly kind: AliasKind;
	readonly specificity: number;
	readonly specifier: string;
	readonly subject: number;
}

const KINDS: readonly AliasKind[] = ["imports", "package"];

function inverse(mappings: readonly Mapping[], kind: AliasKind, subject: string, index: number, on = subject): readonly Candidate[] {
	return mappings.flatMap(({ from, to }) => {
		const capture = captured(to, on);
		return capture === undefined ? [] : [{ kind, specificity: subject.length - capture.length, specifier: filled(from, capture), subject: index }];
	});
}

function candidatesFor(scope: AliasScope, subjects: readonly string[]): readonly Candidate[] {
	return subjects.flatMap((subject, index) => {
		const packaged = inverse(scope.exported, "package", subject, index);
		return [
			...inverse(scope.imports, "imports", subject, index),
			...packaged.flatMap((bare) => inverse(scope.imports, "imports", subject, index, bare.specifier)),
			...(scope.crossing ? packaged : []),
		];
	});
}

// Across workspace packages, an alias the importer's package.json declares comes before the other package's name.
// Within a package, its own name is never an alias, and the most specific alias wins.
function compare(scope: AliasScope): (left: Candidate, right: Candidate) => number {
	return (left, right) =>
		(scope.crossing ? KINDS.indexOf(left.kind) - KINDS.indexOf(right.kind) : 0)
		|| right.specificity - left.specificity
		|| left.subject - right.subject
		|| left.specifier.length - right.specifier.length
		|| left.specifier.localeCompare(right.specifier);
}

export function chooseAlias(
	scope: AliasScope,
	subjects: readonly string[],
	target: string,
	resolves: (specifier: string) => boolean,
): string | undefined {
	const ranked = [...candidatesFor(scope, subjects)].sort(compare(scope));
	return [...new Set(ranked.map((candidate) => candidate.specifier))].find(
		(specifier) => loadsOnly(scope.own, scope.owner, specifier, target) && resolves(specifier),
	);
}
