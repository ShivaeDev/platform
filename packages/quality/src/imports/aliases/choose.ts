import { captured, filled, type Mapping } from "./pattern.ts";

export type AliasKind = "imports" | "package" | "paths";

export interface AliasScope {
	readonly crossing: boolean;
	readonly exported: readonly Mapping[];
	readonly imports: readonly Mapping[];
	readonly paths: readonly Mapping[];
}

interface Candidate {
	readonly kind: AliasKind;
	readonly specificity: number;
	readonly specifier: string;
	readonly subject: number;
}

const KINDS: readonly AliasKind[] = ["imports", "package", "paths"];

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
			...inverse(scope.paths, "paths", subject, index),
			...(scope.crossing ? packaged : []),
		];
	});
}

// Across workspace packages, an alias the importer's package.json declares names the other package by its exports, then the package name
// does, and a path alias, which reaches past those exports, comes last. Within a package, the most specific alias wins.
function tier(scope: AliasScope, kind: AliasKind): number {
	return scope.crossing ? KINDS.indexOf(kind) : 0;
}

function compare(scope: AliasScope): (left: Candidate, right: Candidate) => number {
	return (left, right) =>
		tier(scope, left.kind) - tier(scope, right.kind)
		|| right.specificity - left.specificity
		|| left.subject - right.subject
		|| KINDS.indexOf(left.kind) - KINDS.indexOf(right.kind)
		|| left.specifier.length - right.specifier.length
		|| left.specifier.localeCompare(right.specifier);
}

export function chooseAlias(scope: AliasScope, subjects: readonly string[], reaches: (specifier: string) => boolean): string | undefined {
	const ranked = [...candidatesFor(scope, subjects)].sort(compare(scope));
	return [...new Set(ranked.map((candidate) => candidate.specifier))].find(reaches);
}
