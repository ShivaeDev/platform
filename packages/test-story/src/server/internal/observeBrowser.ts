import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Socket from "effect/socket/Socket";
import type { BrowserReadsOptions } from "#browserReads.ts";
import { browserReadObserver } from "./browserReadObserver.ts";

export const observeBrowser = Effect.fnUntraced(function* (options: BrowserReadsOptions) {
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
