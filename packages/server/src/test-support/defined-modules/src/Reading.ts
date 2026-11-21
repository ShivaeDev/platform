import { Schema } from "effect";

// The application decodes its raw read with this class, so the generated wire imports it and its mark travels with it.
export class Reading extends Schema.Class<Reading>("Reading")({
	day: Schema.String,
	pulse: Schema.Number.annotate({ sensitive: true }),
}) {}
