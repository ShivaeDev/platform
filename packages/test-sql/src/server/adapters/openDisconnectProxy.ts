import { createConnection, createServer, type Socket } from "node:net";
import type { DisconnectProxyOptions } from "#disconnectProxy.ts";
import { notificationFilter } from "./notificationFilter.ts";

export async function openDisconnectProxy(destination: string, options: DisconnectProxyOptions) {
	const target = new URL(destination);
	const address = { host: target.hostname, port: Number(target.port || 5432) };
	const sockets = new Set<Socket>();
	const pending = new Set<Socket>();
	const disconnecting = Promise.withResolvers<void>();
	const allHeld = Promise.withResolvers<void>();
	const dropped = Promise.withResolvers<void>();
	let held = options.holdDisconnects === true;
	let reachable = true;
	let responsive = true;
	let upstreams = 0;
	function disconnect() {
		for (const socket of sockets) {
			socket.destroy();
		}
	}
	function release() {
		held = false;
		for (const socket of pending) {
			socket.end();
		}
	}
	const server = createServer({ allowHalfOpen: true }, (client) => {
		if (!reachable) {
			client.destroy();
			return;
		}
		const upstream = createConnection(address);
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
		const incoming = options.dropNotifications === true ? upstream.pipe(notificationFilter(dropped.resolve)) : upstream;
		incoming.pipe(client, { end: false });
		client.on("end", () => upstream.end());
		upstream.on("end", () => {
			pending.add(client);
			disconnecting.resolve();
			if (pending.size === upstreams) {
				allHeld.resolve();
			}
			if (!held) {
				client.end();
			}
		});
		if (!responsive) {
			client.pause();
			upstream.pause();
		}
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
	if (options.dropNotifications === true) {
		target.searchParams.set("sslmode", "disable");
	}
	return {
		allHeld: allHeld.promise,
		close: async () => {
			disconnect();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
		disconnect,
		disconnecting: disconnecting.promise,
		dropped: dropped.promise,
		release,
		setReachable: (value: boolean) => {
			reachable = value;
			if (!value) {
				disconnect();
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
