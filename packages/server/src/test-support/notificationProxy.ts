import { createConnection, createServer, type Socket } from "node:net";
import { Transform } from "node:stream";

// Keep real SQL working while reproducing a connection that cannot deliver LISTEN notifications.
export async function notificationProxy(destination: string) {
	const target = new URL(destination);
	const upstreamAddress = { host: target.hostname, port: Number(target.port || 5432) };
	const sockets = new Set<Socket>();
	const dropped = Promise.withResolvers<void>();
	const server = createServer((client) => {
		const upstream = createConnection(upstreamAddress);
		let pending = Buffer.alloc(0);
		const filter = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				pending = Buffer.concat([pending, chunk]);
				while (pending.length >= 5) {
					const length = pending.readInt32BE(1) + 1;
					if (pending.length < length) {
						break;
					}
					if (pending[0] === 65) {
						dropped.resolve();
					} else {
						filter.push(pending.subarray(0, length));
					}
					pending = pending.subarray(length);
				}
				callback();
			},
		});
		for (const socket of [client, upstream]) {
			sockets.add(socket);
			socket.on("error", () => {
				client.destroy();
				upstream.destroy();
			});
			socket.on("close", () => sockets.delete(socket));
		}
		client.pipe(upstream).pipe(filter).pipe(client);
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected TCP notification proxy");
	}
	target.hostname = "127.0.0.1";
	target.port = String(address.port);
	target.searchParams.set("sslmode", "disable");
	return {
		close: async () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
		dropped: dropped.promise,
		url: target.toString(),
	};
}
