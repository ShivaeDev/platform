import { Clock, Context, Effect, Latch } from "effect";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { SocketOpenError } from "effect/socket/Socket";

export const connectionReadiness = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const ready = Latch.makeUnsafe(true);
	return {
		close: Effect.asVoid(ready.close),
		isReady: () => ready.isOpen(),
		open: Effect.asVoid(ready.open),
		wait: Effect.suspend(() =>
			ready.await.pipe(
				Effect.timeoutOrElse({
					duration: "10 seconds",
					orElse: () => Effect.fail(new RpcClientError({ reason: new SocketOpenError({ cause: "Waiting for a live connection", kind: "Timeout" }) })),
				}),
				Effect.provideService(Clock.Clock, clock),
			),
		),
	};
});

export class ConnectionReadiness extends Context.Service<ConnectionReadiness, Effect.Success<typeof connectionReadiness>>()(
	"@shivaedev/contract/ConnectionReadiness",
) {}

export const commandConnections = new WeakMap<object, Effect.Effect<void, RpcClientError>>();

export function waitForConnection(client: object) {
	return commandConnections.get(client) ?? Effect.void;
}
