import { createServer, type ServerResponse } from "node:http";
import { Effect, Schema } from "effect";

export const followServer = Effect.fn("FollowTest.followServer")(function* () {
	const subscribed = Promise.withResolvers<void>();
	let response: ServerResponse | undefined;
	let requestId: string | number = "";
	let subscriptions = 0;
	const server = createServer((request, reply) => {
		let body = "";
		request.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		request.on("end", () => {
			const message = Schema.decodeUnknownSync(Schema.Struct({ id: Schema.Union([Schema.String, Schema.Number]) }))(JSON.parse(body.trim()));
			subscriptions += 1;
			requestId = message.id;
			response = reply;
			reply.setHeader("Content-Type", "application/x-ndjson");
			reply.flushHeaders();
			subscribed.resolve();
		});
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	yield* Effect.addFinalizer(() =>
		Effect.promise(
			() =>
				new Promise<void>((resolve) => {
					server.closeAllConnections();
					server.close(() => resolve());
				}),
		),
	);
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a TCP server");
	}
	function connection() {
		if (response === undefined || response.destroyed || response.writableEnded) {
			throw new Error("No active follower subscription");
		}
		return response;
	}
	return {
		disconnect: () => connection().destroy(),
		fail: (message: string) => connection().end(`${JSON.stringify({ _tag: "Defect", defect: { message, name: "Error" } })}\n`),
		port: address.port,
		send: (states: readonly unknown[]) => connection().write(`${JSON.stringify({ _tag: "Chunk", requestId, values: [states] })}\n`),
		subscribed: subscribed.promise,
		subscriptions: () => subscriptions,
	};
});
