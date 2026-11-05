import type { Effect } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";

export interface BrowserPage {
	readonly checkText: (text: string) => Effect.Effect<void, BrowserCheckError>;
	readonly screenshot: (path: string) => Effect.Effect<void, BrowserCheckError>;
	readonly visit: (url: string) => Effect.Effect<void, BrowserCheckError>;
}
