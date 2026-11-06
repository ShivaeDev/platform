import type { Effect, Scope } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";
import type { BrowserSocket } from "#BrowserSocket.ts";

export interface BrowserPage {
	readonly checkText: (text: string) => Effect.Effect<void, BrowserCheckError>;
	readonly screenshot: (path: string) => Effect.Effect<void, BrowserCheckError>;
	readonly visit: (url: string) => Effect.Effect<void, BrowserCheckError>;
	readonly watchSocket: (url: string) => Effect.Effect<BrowserSocket, never, Scope.Scope>;
}
