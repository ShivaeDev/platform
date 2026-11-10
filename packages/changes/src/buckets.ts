import { Schema } from "effect";
import { type Identity, isBucketSchema } from "#keys.ts";

type BucketValue = Identity | null | undefined;

export function bucket<TSchema extends Schema.Top & Schema.ConstraintCodec<BucketValue, unknown, never, never>>(schema: TSchema): TSchema["Rebuild"] {
	return schema.annotate({ "@shivaedev/changes/bucket": true });
}

export function decodeBucketValue(schema: Schema.Constraint) {
	return Schema.decodeUnknownEffect(Schema.make<Schema.Codec<BucketValue, unknown>>(schema.ast));
}

export function declaredBuckets(fields: Schema.Struct.Fields) {
	return Object.entries(fields).flatMap(([field, schema]) => {
		if (Schema.resolveAnnotations(schema)?.["@shivaedev/changes/bucket"] !== true) {
			return [];
		}
		return [{ decode: decodeBucketValue(schema), field, supported: isBucketSchema(schema) }];
	});
}
