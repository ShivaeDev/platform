import type { Effect } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";

export interface BrowserSocket {
	readonly closed: Effect.Effect<void, BrowserCheckError>;
	readonly received: (matches: (payload: string) => boolean) => Effect.Effect<void, BrowserCheckError>;
	readonly sent: (matches: (payload: string) => boolean) => Effect.Effect<void, BrowserCheckError>;
}
