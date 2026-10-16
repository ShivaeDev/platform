import { Schema } from "effect";

export const Server = Schema.Struct({ directory: Schema.String, url: Schema.String });
