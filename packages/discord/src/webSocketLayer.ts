import { Effect, Layer } from "effect";
import { Socket } from "effect/socket";
import { GatewayTransport } from "#GatewayTransport.ts";

export const webSocketLayer = Layer.succeed(GatewayTransport)({
	open: (url) => Socket.makeWebSocket(url).pipe(Effect.provide(Socket.layerWebSocketConstructorGlobal)),
});
