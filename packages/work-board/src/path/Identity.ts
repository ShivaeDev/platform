import { Schema } from "effect";

export const Identity = Schema.String.check(Schema.isPattern(/^[a-zA-Z\d][a-zA-Z\d._-]*$/u));
