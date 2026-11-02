import { Schema } from "effect";

export const CiHold = Schema.Struct({ head: Schema.String, paths: Schema.Array(Schema.String) });
export type CiHold = typeof CiHold.Type;
