import type { Observation } from "@shivaedev/effect-changes";
import type { UnnamedWrite } from "./write.ts";

export type CoverageViolation =
	| { readonly _tag: "Unrecorded"; readonly table: string; readonly model: string | undefined }
	| { readonly _tag: "Unnamed"; readonly write: UnnamedWrite };

export interface Coverage<A> {
	readonly written: Iterable<string>;
	readonly tables: ReadonlyMap<string, string>;
	readonly models: Readonly<Record<string, unknown>>;
	readonly observations: Iterable<Observation<A>>;
	readonly unnamed: Iterable<UnnamedWrite>;
	readonly covers: (model: string, change: A) => boolean;
}

const recordedIn = <A>(observations: Iterable<Observation<A>>): ReadonlyArray<A> =>
	[...observations].flatMap((observation) => (observation._tag === "Recorded" ? observation.changes : []));

const identify = (write: UnnamedWrite): string =>
	write.reason === "narrowed" ? `${write.model}.${write.operation}.${write.field}` : `${write.model}.${write.operation}`;

export const checkCoverage = <A>(coverage: Coverage<A>): ReadonlyArray<CoverageViolation> => {
	const recorded = recordedIn(coverage.observations);
	const unrecorded = [...new Set(coverage.written)].flatMap((table): ReadonlyArray<CoverageViolation> => {
		const model = coverage.tables.get(table);
		if (model !== undefined && coverage.models[model] === null) return [];
		if (model !== undefined && recorded.some((change) => coverage.covers(model, change))) return [];
		return [{ _tag: "Unrecorded", table, model }];
	});
	const unnamed = new Map([...coverage.unnamed].map((write) => [identify(write), write] as const));
	return [...unrecorded, ...[...unnamed.values()].map((write): CoverageViolation => ({ _tag: "Unnamed", write }))];
};
