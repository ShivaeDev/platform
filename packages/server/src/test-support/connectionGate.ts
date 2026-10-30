import { createConnection, createServer, type Socket } from "node:net";

export async function connectionGate(destination: string) {
	const target = new URL(destination);
	const address = { host: target.hostname, port: Number(target.port || 5432) };
	const sockets = new Set<Socket>();
	const pending = new Set<Socket>();
	const open = new Set<Socket>();
	const disconnecting = Promise.withResolvers<void>();
	let held = true;
	const server = createServer({ allowHalfOpen: true }, (client) => {
		const upstream = createConnection(address);
		open.add(client);
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
		client.on("end", () => {
			open.delete(client);
			upstream.end();
		});
		client.on("close", () => open.delete(client));
		upstream.on("end", () => {
			pending.add(client);
			disconnecting.resolve();
			if (!held) {
				client.end();
			}
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const listening = server.address();
	if (listening === null || typeof listening === "string") {
		throw new Error("Expected a TCP listener");
	}
	target.hostname = "127.0.0.1";
	target.port = String(listening.port);
	return {
		close: async () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
		disconnecting: disconnecting.promise,
		openClients: () => open.size,
		release: () => {
			held = false;
			for (const socket of pending) {
				socket.end();
			}
		},
		url: target.toString(),
	};
}
