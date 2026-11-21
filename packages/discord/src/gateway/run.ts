import { Effect } from "effect";
import { Socket } from "effect/socket";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordGatewayClosed } from "#errors.ts";
import { GatewayTransport } from "#GatewayTransport.ts";
import { gatewayConnection } from "#gatewayConnection.ts";
import type { GatewayDispatch, GatewaySession } from "#gatewayProtocol.ts";

export const run = Effect.fn("DiscordGateway.run")(function* (dispatch: (event: GatewayDispatch) => Effect.Effect<void>) {
	const config = yield* DiscordConfig;
	const transport = yield* GatewayTransport;
	const session: GatewaySession = { resumeUrl: undefined, sequence: null, sessionId: undefined };
	while (true) {
		const socket = yield* transport.open(`${session.resumeUrl ?? config.gatewayUrl}/?v=10&encoding=json`);
		yield* gatewayConnection(session, dispatch)
			.pipe(Effect.provideService(Socket.Socket, socket))
			.pipe(
				Effect.catchTag("SocketError", (error) => {
					const code = error.reason._tag === "SocketCloseError" ? error.reason.code : undefined;
					if (code === 4004 || (code !== undefined && code >= 4010 && code <= 4014)) {
						return Effect.fail(new DiscordGatewayClosed({ code }));
					}
					if (code === 4007 || code === 4009) {
						session.sessionId = undefined;
						session.resumeUrl = undefined;
						session.sequence = null;
					}
					return Effect.sleep("1 second");
				}),
			);
	}
});
