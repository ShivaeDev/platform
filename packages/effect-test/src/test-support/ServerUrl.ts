import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { Config, Context, Effect, Layer } from "effect";

export class ServerUrl extends Context.Service<ServerUrl, string>()("@test/ServerUrl") {
	static readonly layer = Layer.effect(
		ServerUrl,
		Effect.gen(function* () {
			const server = yield* Effect.acquireRelease(
				Effect.promise(
					() =>
						new Promise<ReturnType<typeof createServer>>((resolve) => {
							const instance = createServer((_request, response) => response.end("fixture service"));
							instance.listen(0, "127.0.0.1", () => resolve(instance));
						}),
				),
				(instance) => Effect.promise(() => new Promise<void>((resolve, reject) => instance.close((error) => (error ? reject(error) : resolve())))),
			);
			const address = server.address();
			if (address === null || typeof address === "string") {
				return yield* Effect.die("Expected a TCP server");
			}
			const url = `http://127.0.0.1:${address.port}`;
			writeFileSync(yield* Config.String("EFFECT_TEST_SERVER_URL"), url);
			return url;
		}),
	);
}
