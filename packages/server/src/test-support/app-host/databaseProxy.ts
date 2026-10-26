import { createConnection, createServer, type Socket } from "node:net";

export async function databaseProxy(destination: string) {
	const target = new URL(destination);
	const upstreamAddress = { host: target.hostname, port: Number(target.port || 5432) };
	const sockets = new Set<Socket>();
	let reachable = true;
	let responsive = true;
	const server = createServer((client) => {
		if (!reachable) {
			client.destroy();
			return;
		}
		const upstream = createConnection(upstreamAddress);
		for (const socket of [client, upstream]) {
			sockets.add(socket);
			socket.on("error", () => {
				client.destroy();
				upstream.destroy();
			});
			socket.on("close", () => sockets.delete(socket));
		}
		client.pipe(upstream).pipe(client);
		if (!responsive) {
			client.pause();
			upstream.pause();
		}
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
		close: async () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
		setReachable: (value: boolean) => {
			reachable = value;
			if (!value) {
				for (const socket of sockets) {
					socket.destroy();
				}
			}
		},
		setResponsive: (value: boolean) => {
			responsive = value;
			for (const socket of sockets) {
				if (value) {
					socket.resume();
				} else {
					socket.pause();
				}
			}
		},
		url: target.toString(),
	};
}
