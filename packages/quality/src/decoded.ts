import { Effect } from "effect";
import { SetupFailure } from "./failure.ts";
import { describeIssue, type StandardSchemaV1 } from "./standard-schema.ts";

export type Decoded<Value> = { readonly _tag: "Valid"; readonly value: Value } | { readonly _tag: "Invalid"; readonly issues: readonly string[] };

export const decodeWith = async <Output>(schema: StandardSchemaV1<unknown, Output>, value: unknown): Promise<Decoded<Output>> => {
	const result = await schema["~standard"].validate(value);
	return result.issues === undefined ? { _tag: "Valid", value: result.value } : { _tag: "Invalid", issues: result.issues.map(describeIssue) };
};

export const validOrFail = <Value>(file: string, decoded: Decoded<Value>): Effect.Effect<Value, SetupFailure> =>
	decoded._tag === "Valid"
		? Effect.succeed(decoded.value)
		: Effect.fail(new SetupFailure({ message: `${file} is invalid:\n${decoded.issues.map((issue) => `  - ${issue}`).join("\n")}` }));
