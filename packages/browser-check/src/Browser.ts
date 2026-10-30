import { Context, type Effect, Layer, type Scope } from "effect";
import { playwright } from "#adapters/playwright.ts";
import type { BrowserCheckError } from "#BrowserCheckError.ts";

export interface BrowserSession {
	readonly checkText: (text: string) => Effect.Effect<void, BrowserCheckError>;
	readonly screenshot: (path: string) => Effect.Effect<void, BrowserCheckError>;
	readonly signIn: (url: string, email: string, password: string) => Effect.Effect<void, BrowserCheckError>;
	readonly visit: (url: string) => Effect.Effect<void, BrowserCheckError>;
}

export class Browser extends Context.Service<
	Browser,
	{
		readonly open: Effect.Effect<BrowserSession, BrowserCheckError, Scope.Scope>;
	}
>()("@shivaedev/browser-check/Browser") {
	static readonly layer = Layer.effect(Browser, playwright);
}
