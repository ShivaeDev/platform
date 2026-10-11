import { Effect } from "effect";
import { SetupFailure } from "./failure.ts";
import { describeIssue, type StandardSchemaV1 } from "./standard-schema.ts";

export type Decoded<TValue> = { readonly _tag: "Valid"; readonly value: TValue } | { readonly _tag: "Invalid"; readonly issues: readonly string[] };

export const decodeWith = async <TOutput>(schema: StandardSchemaV1<unknown, TOutput>, value: unknown): Promise<Decoded<TOutput>> => {
	const result = await schema["~standard"].validate(value);
	return result.issues === undefined ? { _tag: "Valid", value: result.value } : { _tag: "Invalid", issues: result.issues.map(describeIssue) };
};

export const validOrFail = <TValue>(file: string, decoded: Decoded<TValue>): Effect.Effect<TValue, SetupFailure> =>
	decoded._tag === "Valid"
		? Effect.succeed(decoded.value)
		: Effect.fail(new SetupFailure({ message: `${file} is invalid:\n${decoded.issues.map((issue) => `  - ${issue}`).join("\n")}` }));
