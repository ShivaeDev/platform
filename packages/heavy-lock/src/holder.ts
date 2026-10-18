import { Effect, type Option, Schema } from "effect";

export const HOLDER_ID_ENV = "HEAVY_PROCESS_LOCK_ID";

export const Holder = Schema.Struct({
	command: Schema.String,
	cwd: Schema.String,
	id: Schema.String,
	pid: Schema.Number,
	processStartedAt: Schema.String,
	startedAtMs: Schema.Number,
});

export type Holder = typeof Holder.Type;

const HolderJson = Schema.fromJsonString(Holder);

const PROTOCOL_KEYS = ["id", "pid", "processStartedAt", "command", "cwd", "startedAtMs"];

export function encodeHolder(holder: Holder): Effect.Effect<string> {
	return Schema.encodeEffect(Holder)(holder).pipe(
		Effect.map((encoded) => JSON.stringify(encoded, PROTOCOL_KEYS)),
		Effect.orDie,
	);
}

export function decodeHolder(raw: string): Option.Option<Holder> {
	return Schema.decodeUnknownOption(HolderJson)(raw);
}
