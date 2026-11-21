import { Data, Effect, Order, type Schema } from "effect";
import type { Model } from "effect/schema";
import { declaredBuckets } from "@shivaedev/changes/buckets.ts";
import { isBucketSchema } from "@shivaedev/changes/keys.ts";
import type { IdColumn } from "#versionedRepository.ts";

export interface RepositoryCollection {
	readonly bucket: Readonly<Record<string, unknown>>;
	readonly name: string;
	readonly tuples?: Readonly<Record<string, readonly [string, string, ...string[]]>>;
}

export type RepositoryTable =
	| { readonly collection: RepositoryCollection; readonly tableName?: never }
	| { readonly collection?: never; readonly tableName: string };

// A model without an id field has no default ID column to fall back on, so it must name one.
export type RepositoryKey<TModel extends Model.Any, TId> = {
	readonly idColumn?: TId;
	readonly spanPrefix?: string;
} & ("id" extends IdColumn<TModel> ? unknown : { readonly idColumn: TId });

export type RepositoryOptions<TModel extends Model.Any, TId> = RepositoryTable & RepositoryKey<TModel, TId>;

export function resolveRepositoryOptions<TOptions extends RepositoryTable & { readonly idColumn?: unknown; readonly spanPrefix?: string }>(
	options: TOptions,
) {
	const tableName = options.collection === undefined ? options.tableName : options.collection.name;
	return { ...options, idColumn: options.idColumn ?? "id", spanPrefix: options.spanPrefix ?? tableName, tableName };
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
		const registration = `Bucket registration for ${this.tableName}`;
		if (this.invalidFields.length > 0) {
			return `${registration}: fields ${JSON.stringify(this.invalidFields)} must decode to strings, numbers or absent values`;
		}
		if (this.invalidTupleColumns.length > 0) {
			return `${registration}: tuple columns ${JSON.stringify(this.invalidTupleColumns)} must be model fields that decode to strings, numbers or absent values`;
		}
		if (this.collectionName === undefined) {
			return `${registration}: model bucket fields ${JSON.stringify(this.modelFields)} need the repository's collection option in place of tableName: a collection named "${this.tableName}" with exactly those bucket fields`;
		}
		return `${registration}: collection bucket fields ${JSON.stringify(this.collectionFields)} must equal model bucket fields ${JSON.stringify(this.modelFields)}`;
	}
}

export class ServerOnlyKeyError extends Data.TaggedError("ServerOnlyKeyError")<{
	readonly tableName: string;
	readonly fields: readonly string[];
}> {
	override get message() {
		return `Repository for ${this.tableName}: server-only fields ${JSON.stringify(this.fields)} cannot be an ID column or a bucket, because their values would be announced as change keys; key the table by another column`;
	}
}

export class EncryptedKeyError extends Data.TaggedError("EncryptedKeyError")<{
	readonly tableName: string;
	readonly fields: readonly string[];
}> {
	override get message() {
		return `Repository for ${this.tableName}: encrypted fields ${JSON.stringify(this.fields)} cannot be an ID column, a bucket or a conflict column, because every write seals them under a fresh random nonce, so equal values never match; key the table by another column`;
	}
}

export class OwnerFieldError extends Data.TaggedError("OwnerFieldError")<{
	readonly tableName: string;
	readonly fields: readonly string[];
	readonly reason: "encrypted" | "several" | "server-only";
}> {
	override get message() {
		const repository = `Repository for ${this.tableName}`;
		return this.reason === "several"
			? `${repository}: owner fields ${JSON.stringify(this.fields)} each claim the row's person; mark exactly one field as owner`
			: `${repository}: owner field ${JSON.stringify(this.fields)} is ${this.reason}, but it must decode to the plain user id that selects a person's rows for export and erasure`;
	}
}

export type RepositoryBuildError = BucketRegistrationError | EncryptedKeyError | OwnerFieldError | ServerOnlyKeyError;

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
			|| (options.collection !== undefined
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
