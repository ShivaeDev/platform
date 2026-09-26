import { Effect, type Option, Schema } from "effect";

export const HOLDER_ID_ENV = "HEAVY_PROCESS_LOCK_ID";

export const Holder = Schema.Struct({
	id: Schema.String,
	pid: Schema.Number,
	processStartedAt: Schema.String,
	command: Schema.String,
	cwd: Schema.String,
	startedAtMs: Schema.Number,
});

export type Holder = typeof Holder.Type;

const HolderJson = Schema.fromJsonString(Holder);

export const encodeHolder = (holder: Holder): Effect.Effect<string> => Schema.encodeEffect(HolderJson)(holder).pipe(Effect.orDie);

export const decodeHolder = (raw: string): Option.Option<Holder> => Schema.decodeUnknownOption(HolderJson)(raw);
