import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { collection, compositeId, type Identity, type Key } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";

type Where = Readonly<Record<string, unknown>>;

export type RecordRead = (where?: Where) => Effect.Effect<void, Schema.SchemaError, unknown>;

const AnyIdentity = Schema.Union([Schema.String, Schema.Number]);

function isIdentity(value: unknown): value is Identity {
	return typeof value === "string" || typeof value === "number";
}

function isPrimitive(value: unknown): value is Identity | bigint | boolean {
	return isIdentity(value) || typeof value === "bigint" || typeof value === "boolean";
}

function combinations(columns: readonly (readonly unknown[])[]): readonly (readonly unknown[])[] {
	return columns.reduce<readonly (readonly unknown[])[]>((rows, values) => rows.flatMap((row) => values.map((value) => [...row, value])), [[]]);
}

export function makeRecordRead(model: Model.Any, options: { readonly tableName: string; readonly idColumns: readonly string[] }): RecordRead {
	const fields = declaredBuckets(model.fields).map(({ field }) => field);
	const keys = collection(options.tableName, AnyIdentity, Object.fromEntries(fields.map((field) => [field, AnyIdentity])));
	const buckets = fields.flatMap((field) => {
		const make = keys.bucket[field];
		return make === undefined ? [] : [{ field, make }];
	});
	function pinned(where: Where, column: string): readonly unknown[] | undefined {
		const field = model.fields[column];
		const value = where[column];
		if (field === undefined || value === undefined || value === null) {
			return undefined;
		}
		if (Schema.is(field)(value)) {
			return [value];
		}
		return typeof value === "object" && "in" in value && Array.isArray(value.in)
			? value.in.filter((entry) => entry !== null && entry !== undefined)
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
	function bucketKeys(where: Where): readonly Key[] | undefined {
		let narrowest: readonly Key[] | undefined;
		for (const { field, make } of buckets) {
			const values = pinned(where, field)?.filter(isIdentity);
			if (values !== undefined && (narrowest === undefined || values.length < narrowest.length)) {
				narrowest = values.map(make);
			}
		}
		return narrowest;
	}
	return (where = {}) =>
		Effect.gen(function* () {
			yield* recordRead((yield* rowKeys(where)) ?? bucketKeys(where) ?? [keys.list]);
		});
}
