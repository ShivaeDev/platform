import { Schema } from "effect";

export const HostReady = Schema.Struct({ pid: Schema.Number, type: Schema.Literal("host-ready"), url: Schema.String });
export const HostPrepared = Schema.Struct({ type: Schema.Literal("host-prepared") });
export const HostSignal = Schema.Struct({ signal: Schema.String, type: Schema.Literal("host-signal") });
export const HostReadouts = Schema.Struct({
	activeWork: Schema.Array(Schema.String),
	finalizers: Schema.Array(Schema.String),
	shutdownDuration: Schema.NullOr(Schema.Number),
	type: Schema.Literal("host-readouts"),
});
