import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Config, type Duration, Effect, Layer } from "effect";

export function nodeHttpServer(
	host: string,
	config?: {
		readonly port?: number;
		readonly gracefulShutdownTimeout?: Duration.Input;
		readonly disablePreemptiveShutdown?: boolean;
	},
) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const port = config?.port ?? (yield* Config.Int("PORT").pipe(Config.withDefault(3000)));
			return NodeHttpServer.layer(createServer, {
				gracefulShutdownTimeout: config?.gracefulShutdownTimeout,
				host,
				port,
				...(config?.disablePreemptiveShutdown === undefined ? {} : { disablePreemptiveShutdown: config.disablePreemptiveShutdown }),
			});
		}),
	);
}
