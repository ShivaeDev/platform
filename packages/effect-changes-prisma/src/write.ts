import { countOperations, type RowOperation, rowOperations } from "./model.ts";

export interface Write {
	readonly model: string;
	readonly operation: string;
	readonly result: unknown;
}

export type UnnamedWrite =
	| { readonly model: string; readonly operation: string; readonly reason: "countOnly" }
	| { readonly model: string; readonly operation: string; readonly reason: "narrowed"; readonly field: string };

export type LooseChanges<A> = { bivariant(row: object, operation: RowOperation): Iterable<A> }["bivariant"];

export type LooseMap<A> = Readonly<Record<string, LooseChanges<A> | null | undefined>>;

export interface Interpreted<A> {
	readonly changes: ReadonlyArray<A>;
	readonly unnamed: UnnamedWrite | undefined;
}

class MissingField {
	readonly field: string;

	constructor(field: string) {
		this.field = field;
	}
}

const guarded = (row: object): object =>
	new Proxy(row, {
		get: (target, key, receiver) => {
			if (typeof key === "string" && !(key in target)) throw new MissingField(key);
			return Reflect.get(target, key, receiver);
		},
	});

const isRowOperation = (operation: string): operation is RowOperation => rowOperations.has(operation);

const rowsOf = (result: unknown): ReadonlyArray<object> =>
	(Array.isArray(result) ? result : [result]).filter((row): row is object => typeof row === "object" && row !== null);

const nothing: Interpreted<never> = { changes: [], unnamed: undefined };

export const interpret = <A>(models: LooseMap<A>, write: Write): Interpreted<A> => {
	const { model, operation } = write;
	const changesOf = models[model];
	if (changesOf === undefined || changesOf === null) return nothing;
	if (countOperations.has(operation)) return { changes: [], unnamed: { model, operation, reason: "countOnly" } };
	if (!isRowOperation(operation)) return nothing;
	const changes: Array<A> = [];
	try {
		for (const row of rowsOf(write.result)) changes.push(...changesOf(guarded(row), operation));
	} catch (error) {
		if (error instanceof MissingField) return { changes: [], unnamed: { field: error.field, model, operation, reason: "narrowed" } };
		throw error;
	}
	return { changes, unnamed: undefined };
};
