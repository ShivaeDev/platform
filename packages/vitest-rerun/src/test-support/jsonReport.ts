import { Schema } from "effect";

export const JsonReport = Schema.Struct({
	coverageMap: Schema.optional(
		Schema.Record(
			Schema.String,
			Schema.Struct({
				f: Schema.Record(Schema.String, Schema.Number),
				fnMap: Schema.Record(Schema.String, Schema.Struct({ name: Schema.String })),
			}),
		),
	),
	snapshot: Schema.optional(Schema.Struct({ matched: Schema.Number, total: Schema.Number })),
	testResults: Schema.Array(
		Schema.Struct({
			assertionResults: Schema.Array(
				Schema.Struct({
					ancestorTitles: Schema.Array(Schema.String),
					duration: Schema.optional(Schema.NullOr(Schema.Number)),
					status: Schema.String,
					title: Schema.String,
				}),
			),
			durationMs: Schema.optional(Schema.Number),
			name: Schema.String,
		}),
	),
});
export type JsonReport = typeof JsonReport.Type;
export const decodeJsonReport = Schema.decodeUnknownSync(Schema.fromJsonString(JsonReport));
