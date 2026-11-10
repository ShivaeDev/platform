import { createServer } from "node:http";
import type { Socket } from "node:net";

export function trackedSockets() {
	const sockets = new Set<Socket>();
	const server = createServer().on("connection", (socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});
	return {
		destroy: () => {
			for (const socket of sockets) {
				socket.destroy();
			}
		},
		pause: () => {
			for (const socket of sockets) {
				socket.pause();
			}
		},
		server,
	};
}
