import { Effect, Result, Schema, SchemaIssue } from "effect";
import { SetupFailure } from "./failure.ts";
import { describeIssue } from "./standardSchema.ts";

export type Decoded<TValue> = { readonly _tag: "Valid"; readonly value: TValue } | { readonly _tag: "Invalid"; readonly issues: readonly string[] };

export function decodeWith<TSchema extends Schema.ConstraintDecoder<unknown>>(schema: TSchema, value: unknown): Promise<Decoded<TSchema["Type"]>> {
	const result = Schema.decodeUnknownResult(schema, { errors: "all", onExcessProperty: "error" })(value);
	return Promise.resolve(
		Result.isSuccess(result)
			? { _tag: "Valid", value: result.success }
			: { _tag: "Invalid", issues: SchemaIssue.makeFormatterStandardSchemaV1()(result.failure.issue).issues.map(describeIssue) },
	);
}

export function validOrFail<TValue>(file: string, decoded: Decoded<TValue>): Effect.Effect<TValue, SetupFailure> {
	return decoded._tag === "Valid"
		? Effect.succeed(decoded.value)
		: Effect.fail(new SetupFailure({ message: `${file} is invalid:\n${decoded.issues.map((issue) => `  - ${issue}`).join("\n")}` }));
}
