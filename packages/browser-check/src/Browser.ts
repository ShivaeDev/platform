import { Context, type Effect, type Scope } from "effect";
import type { BrowserCheckError } from "#BrowserCheckError.ts";
import type { BrowserPage } from "#BrowserPage.ts";

export interface BrowserSession {
	readonly newPage: Effect.Effect<BrowserPage, BrowserCheckError>;
	readonly signIn: (url: string, email: string, password: string) => Effect.Effect<void, BrowserCheckError>;
}

export class Browser extends Context.Service<
	Browser,
	{
		readonly open: Effect.Effect<BrowserSession, BrowserCheckError, Scope.Scope>;
	}
>()("@shivaedev/browser-check/Browser") {}
