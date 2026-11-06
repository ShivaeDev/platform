import type { Effect } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";

export interface BrowserSocket {
	readonly nextMessage: Effect.Effect<string | Uint8Array, BrowserCheckError>;
}
