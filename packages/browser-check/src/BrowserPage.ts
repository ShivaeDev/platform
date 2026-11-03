import type { Effect } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";
import type { BrowserSocket } from "#BrowserSocket.ts";

export type BrowserLocator =
	| { readonly label: string }
	| { readonly role: "heading" | "button" | "link" | "alert"; readonly name?: string; readonly text?: string };

export interface BrowserPage {
	readonly checkText: (text: string) => Effect.Effect<void, BrowserCheckError>;
	readonly click: (locator: BrowserLocator) => Effect.Effect<void, BrowserCheckError>;
	readonly fill: (locator: BrowserLocator, value: string) => Effect.Effect<void, BrowserCheckError>;
	readonly navigationCount: Effect.Effect<number>;
	readonly screenshot: (path: string) => Effect.Effect<void, BrowserCheckError>;
	readonly socket: (path: string) => Effect.Effect<BrowserSocket, BrowserCheckError>;
	readonly visit: (url: string) => Effect.Effect<void, BrowserCheckError>;
	readonly waitFor: (locator: BrowserLocator, state?: "visible" | "hidden") => Effect.Effect<void, BrowserCheckError>;
}
