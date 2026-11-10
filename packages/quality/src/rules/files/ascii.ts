import { Effect, type FileSystem, Schema } from "effect";
import { asciiFindings } from "#asciiFindings.ts";
import { defineRule } from "#rule.ts";

const ForbiddenCharacter = Schema.Struct({
	codePoint: Schema.optional(Schema.Number),
	message: Schema.optional(Schema.String),
	range: Schema.optional(Schema.Tuple([Schema.Number, Schema.Number])),
	replacement: Schema.optional(Schema.String),
});

const AsciiOptionsSchema = Schema.Struct({
	files: Schema.Array(Schema.NonEmptyString).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
	forbidden: Schema.optional(Schema.Array(ForbiddenCharacter)),
});

type AsciiOptionsValue = Schema.Schema.Type<typeof AsciiOptionsSchema>;

export const ascii = defineRule<"files/ascii", unknown, AsciiOptionsValue, FileSystem.FileSystem>({
	check: asciiFindings,
	description: "Chosen text files contain only ASCII characters or avoid the configured forbidden characters. No files are selected by default.",
	id: "files/ascii",
	options: Schema.toStandardSchemaV1(AsciiOptionsSchema, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	validate: ({ options }) =>
		(options.forbidden ?? []).flatMap((entry, index) => {
			const path = `forbidden[${index}]`;
			const hasCodePoint = entry.codePoint !== undefined;
			const hasRange = entry.range !== undefined;
			const points = entry.range ?? (hasCodePoint ? [entry.codePoint, entry.codePoint] : undefined);
			return [
				...(hasCodePoint === hasRange ? [`${path} must name exactly one codePoint or range`] : []),
				...(points !== undefined && (points.some((point) => !Number.isInteger(point) || point < 0 || point > 0x10_ff_ff) || points[0] > points[1])
					? [`${path} must contain valid Unicode code points in ascending order`]
					: []),
				...(entry.message !== undefined && entry.replacement !== undefined ? [`${path} cannot have both message and replacement`] : []),
			];
		}),
});
