import { request } from "node:http";
import { Clock, Effect } from "effect";

export const shutdownConnection = Effect.fn("Story.shutdownConnection")(function* (address: string, subscribe: boolean) {
	const clock = yield* Clock.Clock;
	const started = Promise.withResolvers<void>();
	const closed = Promise.withResolvers<{ body: string; status: number; at: number }>();
	let body = "";
	const tcp = address.startsWith("http:");
	const outgoing = request(
		new URL("/_board/rpc", tcp ? address : "http://localhost"),
		{
			...(tcp ? {} : { socketPath: address }),
			headers: { "content-type": "application/ndjson", host: "localhost", ...(subscribe ? {} : { expect: "100-continue" }) },
			method: "POST",
		},
		(response) => {
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => {
				body += chunk;
				started.resolve();
			});
			response.on("end", () => closed.resolve({ at: clock.currentTimeMillisUnsafe(), body, status: response.statusCode ?? 0 }));
			response.on("error", () => closed.resolve({ at: clock.currentTimeMillisUnsafe(), body: "cut", status: 0 }));
		},
	);
	outgoing.on("error", () => closed.resolve({ at: clock.currentTimeMillisUnsafe(), body: "cut", status: 0 }));
	yield* Effect.addFinalizer(() => Effect.sync(() => outgoing.destroy()));
	if (subscribe) {
		outgoing.end(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.subscribe" })}\n`);
		yield* Effect.promise(() => started.promise).pipe(Effect.timeout("5 seconds"));
	} else {
		outgoing.on("continue", () => started.resolve());
		outgoing.flushHeaders();
		yield* Effect.promise(() => started.promise).pipe(Effect.timeout("5 seconds"));
	}
	return { closed: Effect.promise(() => closed.promise) };
});
