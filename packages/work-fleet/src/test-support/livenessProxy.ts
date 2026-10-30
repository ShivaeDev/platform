import { type ClientRequest, createServer, request } from "node:http";
import { Clock, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";

export const livenessProxy = Effect.fn("DaemonTest.livenessProxy")(function* (port: number) {
	const clock = yield* Clock.Clock;
	const probed = Promise.withResolvers<void>();
	const answered = Promise.withResolvers<void>();
	const requests = new Set<ClientRequest>();
	const started: number[] = [];
	const overlaps: number[] = [];
	let stalled = true;
	let active = 0;
	const server = createServer((incoming, outgoing) => {
		const live = incoming.url === "/live";
		if (live) {
			started.push(clock.currentTimeMillisUnsafe());
			if (active > 0) {
				overlaps.push(clock.currentTimeMillisUnsafe());
			}
			active += 1;
			outgoing.on("close", () => {
				active -= 1;
			});
			probed.resolve();
			if (stalled) {
				incoming.resume();
				return;
			}
		}
		const upstream = request({ headers: incoming.headers, hostname: "127.0.0.1", method: incoming.method, path: incoming.url, port }, (response) => {
			outgoing.writeHead(response.statusCode ?? HttpStatus.fromLiteral("BadGateway"), response.headers);
			response.pipe(outgoing);
			if (live) {
				response.on("end", () => answered.resolve());
			}
		});
		requests.add(upstream);
		upstream.on("close", () => requests.delete(upstream));
		upstream.on("error", () => outgoing.destroy());
		outgoing.on("close", () => upstream.destroy());
		incoming.pipe(upstream);
	});
	yield* Effect.addFinalizer(() =>
		Effect.promise(
			() =>
				new Promise<void>((resolve) => {
					for (const upstream of requests) {
						upstream.destroy();
					}
					server.closeAllConnections();
					server.close(() => resolve());
				}),
		),
	);
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a TCP proxy");
	}
	return {
		answered: Effect.promise(() => answered.promise),
		port: address.port,
		probed: Effect.promise(() => probed.promise),
		probes: () => ({ overlaps: [...overlaps], started: [...started] }),
		resume: () => {
			stalled = false;
		},
	};
});
