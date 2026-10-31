import { Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { browserReadObserver } from "#internal/browserReadObserver.ts";

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
	const { observeProtocol, ...observed } = yield* browserReadObserver(options.contracts);
	const memoMap = yield* Layer.makeMemoMap;
	const protocol = Atom.family((_identity: string | undefined) => {
		const layer = Layer.effect(RpcClient.Protocol, observeProtocol).pipe(Layer.provide(socketProtocol(options)));
		return Layer.effectContext(Effect.flatMap(Effect.scope, (scope) => Layer.buildWithMemoMap(layer, memoMap, scope)));
	});
	return { ...observed, protocol };
});

function socketProtocol(options: BrowserReadsOptions) {
	const socket = Socket.layerWebSocket(options.url.replace(/^http/u, "ws"), { headers: options.headers }).pipe(
		Layer.provide(options.webSocketConstructor ?? Socket.layerWebSocketConstructorGlobal),
	);
	return RpcClient.layerProtocolSocket().pipe(Layer.provide(socket), Layer.provide(RpcSerialization.layerNdjson));
}
