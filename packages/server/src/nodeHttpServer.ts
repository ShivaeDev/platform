import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Config, type Duration, Effect, Layer } from "effect";

export function nodeHttpServer(
	host: string,
	config?: {
		readonly port?: number;
		readonly gracefulShutdownTimeout?: Duration.Input;
		readonly disablePreemptiveShutdown?: boolean;
		readonly maxBodySize?: number;
	},
) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const port = config?.port ?? (yield* Config.Int("PORT").pipe(Config.withDefault(3000)));
			return NodeHttpServer.layer(createServer, {
				gracefulShutdownTimeout: config?.gracefulShutdownTimeout,
				host,
				port,
				websocket: config?.maxBodySize === undefined ? undefined : { maxPayload: socketPayloadLimit(config.maxBodySize) },
				...(config?.disablePreemptiveShutdown === undefined ? {} : { disablePreemptiveShutdown: config.disablePreemptiveShutdown }),
			});
		}),
	);
}

function socketPayloadLimit(bytes: number) {
	// ws truncates maxPayload to a signed 32-bit integer; the RPC reader covers zero and larger limits.
	return bytes > 0x7f_ff_ff_ff ? 0 : Math.max(1, bytes);
}
