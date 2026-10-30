import { createConnection, createServer, type Socket } from "node:net";

export type DisconnectGate = Awaited<ReturnType<typeof disconnectGate>>;

export async function disconnectGate(destination: string) {
	const target = new URL(destination);
	const destinationAddress = { host: target.hostname, port: Number(target.port || 5432) };
	const sockets = new Set<Socket>();
	const pending = new Set<Socket>();
	let held = true;
	let upstreams = 0;
	const allHeld = Promise.withResolvers<void>();
	const server = createServer({ allowHalfOpen: true }, (client) => {
		const upstream = createConnection(destinationAddress);
		upstreams += 1;
		for (const socket of [client, upstream]) {
			sockets.add(socket);
			socket.on("close", () => sockets.delete(socket));
			socket.on("error", () => {
				client.destroy();
				upstream.destroy();
			});
		}
		client.pipe(upstream, { end: false });
		upstream.pipe(client, { end: false });
		client.on("end", () => upstream.end());
		upstream.on("end", () => {
			pending.add(client);
			if (pending.size === upstreams) {
				allHeld.resolve();
			}
			if (!held) {
				client.end();
			}
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP listener");
	}
	target.hostname = "127.0.0.1";
	target.port = String(address.port);
	return {
		allHeld: allHeld.promise,
		async close() {
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
		release() {
			held = false;
			for (const socket of pending) {
				socket.end();
			}
		},
		url: target.toString(),
	};
}
