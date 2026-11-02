import { Schema } from "effect";

export const HostReady = Schema.Struct({ pid: Schema.Number, type: Schema.Literal("host-ready"), url: Schema.String });
export const HostSignal = Schema.Struct({ signal: Schema.String, type: Schema.Literal("host-signal") });
