import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Socket from "effect/socket/Socket";

export type BrowserSubscription = {
	readonly payload: unknown;
	readonly tag: string;
} & ({ readonly state: "open" | "answered" } | { readonly state: "refused"; readonly refusalTag: string });

export interface BrowserRead {
	readonly kind: "query" | "subscription";
	readonly payload: unknown;
	readonly tag: string;
}

export interface BrowserReadsOptions {
	readonly contracts: readonly {
		readonly declaration: { readonly name: string; readonly queries: readonly { readonly name: string }[] };
	}[];
	readonly headers?: Readonly<Record<string, string>>;
	readonly url: string;
	readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}

export const browserReads = Effect.fn("BrowserStory.browserReads")(function* (options: BrowserReadsOptions) {
	const { observeBrowser } = yield* Effect.promise(() => import("#internal/observeBrowser.ts"));
	return yield* observeBrowser(options);
});
