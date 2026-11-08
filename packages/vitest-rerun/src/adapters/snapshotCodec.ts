import { deserialize, serialize } from "node:v8";
import { Effect } from "effect";

export function serializeSnapshot(snapshot: unknown) {
	return Effect.sync((): Uint8Array => serialize(snapshot));
}

export function deserializeSnapshot(bytes: Uint8Array) {
	return Effect.try({ catch: (cause) => cause, try: (): unknown => deserialize(bytes) });
}
