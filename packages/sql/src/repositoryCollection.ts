import { Data, Effect, Order, type Schema } from "effect";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { isBucketSchema } from "@shivaedev/changes/keys.ts";

export interface RepositoryCollection {
	readonly bucket: Readonly<Record<string, unknown>>;
	readonly name: string;
	readonly tuples?: Readonly<Record<string, readonly [string, string, ...string[]]>>;
}

export interface RepositoryOptions<TId> {
	readonly collection?: RepositoryCollection;
	readonly idColumn: TId;
	readonly spanPrefix: string;
	readonly tableName: string;
}

export class BucketRegistrationError extends Data.TaggedError("BucketRegistrationError")<{
	readonly tableName: string;
	readonly collectionName: string | undefined;
	readonly modelFields: readonly string[];
	readonly collectionFields: readonly string[];
	readonly invalidFields: readonly string[];
	readonly invalidTupleColumns: readonly string[];
}> {
	override get message() {
		if (this.invalidFields.length > 0) {
			return `Bucket registration for ${this.tableName}: fields ${JSON.stringify(this.invalidFields)} must decode to strings, numbers or absent values`;
		}
		if (this.invalidTupleColumns.length > 0) {
			return `Bucket registration for ${this.tableName}: tuple columns ${JSON.stringify(this.invalidTupleColumns)} must be model fields that decode to strings, numbers or absent values`;
		}
		return `Bucket registration for ${this.tableName}: model fields ${JSON.stringify(this.modelFields)} disagree with collection ${this.collectionName ?? "(missing)"} fields ${JSON.stringify(this.collectionFields)}`;
	}
}

export const validateRepositoryCollection = Effect.fnUntraced(function* (
	fields: Schema.Struct.Fields,
	options: { readonly tableName: string; readonly collection?: RepositoryCollection },
) {
	const buckets = declaredBuckets(fields);
	const invalidFields = buckets
		.filter(({ supported }) => !supported)
		.map(({ field }) => field)
		.sort(Order.String);
	const tuples = options.collection?.tuples ?? {};
	const invalidTupleColumns = Object.entries(tuples).flatMap(([tuple, columns]) =>
		columns.flatMap((column) => {
			const schema = fields[column];
			return schema !== undefined && isBucketSchema(schema) ? [] : [`${tuple}.${column}`];
		}),
	);
	const modelFields = buckets.map(({ field }) => field).sort(Order.String);
	const collectionFields = Object.keys(options.collection?.bucket ?? {})
		.filter((field) => !Object.hasOwn(tuples, field))
		.sort(Order.String);
	if (
		invalidFields.length === 0
		&& invalidTupleColumns.length === 0
		&& ((options.collection === undefined && modelFields.length === 0)
			|| (options.collection?.name === options.tableName
				&& modelFields.length === collectionFields.length
				&& modelFields.every((field, index) => field === collectionFields[index])))
	) {
		return;
	}
	return yield* Effect.fail(
		new BucketRegistrationError({
			collectionFields,
			collectionName: options.collection?.name,
			invalidFields,
			invalidTupleColumns,
			modelFields,
			tableName: options.tableName,
		}),
	);
});
