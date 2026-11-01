import { Context, Effect, Schema } from "effect";
import { defineRule } from "#rule.ts";

export class LineAllowance extends Context.Service<LineAllowance, number>()("quality/test/LineAllowance") {}

export const customServiceRule = defineRule({
	check: ({ options, sources }) =>
		Effect.gen(function* () {
			const limit = options.max + (yield* LineAllowance);
			return sources.flatMap((file) =>
				file.lines.length > limit ? [{ file: file.path, message: `${file.lines.length} lines exceed ${limit}.` }] : [],
			);
		}),
	description: "Keep files within the supplied line allowance.",
	id: "local/line-limit",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.NumberFromString })),
	registrable: false,
});
