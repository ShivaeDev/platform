import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { collection, compositeId, type Identity, type Key } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";
import type { RepositoryCollection } from "#repositoryCollection.ts";

type Where = Readonly<Record<string, unknown>>;

export type RecordRead = (where?: Where) => Effect.Effect<void, Schema.SchemaError, unknown>;

const AnyIdentity = Schema.Union([Schema.String, Schema.Number]);

// Each key is its own registration, renewed on every rerun, so a read pinned to more keys listens on a broader bucket instead.
const MAX_BUCKET_KEYS = 1000;

function isIdentity(value: unknown): value is Identity {
	return typeof value === "string" || typeof value === "number";
}

function isPrimitive(value: unknown): value is Identity | bigint | boolean {
	return isIdentity(value) || typeof value === "bigint" || typeof value === "boolean";
}

function combinations<T>(columns: readonly (readonly T[])[]): readonly (readonly T[])[] {
	return columns.reduce<readonly (readonly T[])[]>((rows, values) => rows.flatMap((row) => values.map((value) => [...row, value])), [[]]);
}

type Pin = readonly [column: string, value: Identity];

interface Bucket {
	readonly columns: readonly string[];
	readonly make: (pins: readonly Pin[]) => readonly Key[];
}

export function makeRecordRead(
	model: Model.Any,
	options: { readonly tableName: string; readonly idColumns: readonly string[]; readonly tuples?: RepositoryCollection["tuples"] },
): RecordRead {
	const fields = declaredBuckets(model.fields).map(({ field }) => field);
	const keys = collection(options.tableName, AnyIdentity, Object.fromEntries(fields.map((field) => [field, AnyIdentity])));
	const tupleKeys = collection(options.tableName, AnyIdentity, {}, options.tuples);
	const buckets: readonly Bucket[] = [
		...Object.entries(tupleKeys.tuples).flatMap(([tuple, columns]) => {
			const make = tupleKeys.bucket[tuple];
			return make === undefined ? [] : [{ columns, make: (pins: readonly Pin[]) => [make(Object.fromEntries(pins))] }];
		}),
		...fields.flatMap((field) => {
			const make = keys.bucket[field];
			return make === undefined ? [] : [{ columns: [field], make: (pins: readonly Pin[]) => pins.map(([, value]) => make(value)) }];
		}),
	];
	function pinned(where: Where, column: string): readonly unknown[] | undefined {
		const field = model.fields[column];
		const value = where[column];
		if (field === undefined || value === undefined || value === null) {
			return undefined;
		}
		const acceptsValue: (input: unknown) => boolean = Schema.is(field);
		if (acceptsValue(value)) {
			return [value];
		}
		return typeof value === "object" && "in" in value && Array.isArray(value.in) && value.in.every((entry) => entry !== null && entry !== undefined)
			? value.in
			: undefined;
	}
	// Writes key a row by the values the driver returns, which the encoded value matches unless the codec wraps it in a driver parameter.
	const storedPart = Effect.fnUntraced(function* (column: string, value: unknown) {
		const field = model.fields[column];
		const encoded = field === undefined ? undefined : yield* Schema.encodeUnknownEffect(field)(value);
		return [encoded, value].find(isPrimitive);
	});
	const rowId = Effect.fnUntraced(function* (row: readonly unknown[]) {
		const [single] = row;
		if (row.length === 1 && isIdentity(single)) {
			return single;
		}
		const parts = yield* Effect.forEach(row, (value, index) => storedPart(options.idColumns[index] ?? "", value));
		if (!parts.every(isPrimitive)) {
			return undefined;
		}
		return parts.length === 1 ? String(parts[0]) : compositeId(parts);
	});
	const rowKeys = Effect.fnUntraced(function* (where: Where) {
		const columns: (readonly unknown[])[] = [];
		for (const column of options.idColumns) {
			const values = pinned(where, column);
			if (values === undefined) {
				return undefined;
			}
			columns.push(values);
		}
		const ids = yield* Effect.forEach(combinations(columns), rowId);
		return ids.every((id) => id !== undefined) ? ids.map((id): Key => keys.item(id)) : undefined;
	});
	function pinnedKeys(where: Where, { columns, make }: Bucket) {
		const pins: (readonly Pin[])[] = [];
		let count = 1;
		for (const column of columns) {
			const values = pinned(where, column);
			if (values === undefined || !values.every(isIdentity)) {
				return undefined;
			}
			count *= values.length;
			pins.push(values.map((value): Pin => [column, value]));
		}
		return count > MAX_BUCKET_KEYS ? undefined : { columns, keys: combinations(pins).flatMap(make) };
	}
	function bucketKeys(where: Where): readonly Key[] | undefined {
		const pinnedBuckets = buckets.flatMap((bucket) => pinnedKeys(where, bucket) ?? []);
		let narrowest: readonly Key[] | undefined;
		for (const { columns, keys: candidate } of pinnedBuckets) {
			const covered = pinnedBuckets.some(
				(other) => other.columns.length > columns.length && columns.every((column) => other.columns.includes(column)),
			);
			if (!covered && (narrowest === undefined || candidate.length < narrowest.length)) {
				narrowest = candidate;
			}
		}
		return narrowest;
	}
	return (where = {}) =>
		Effect.gen(function* () {
			yield* recordRead((yield* rowKeys(where)) ?? bucketKeys(where) ?? [keys.list], { inferred: true });
		});
}
