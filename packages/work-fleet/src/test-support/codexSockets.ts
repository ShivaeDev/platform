import type { Server } from "node:http";
import type { Duplex } from "node:stream";

export function codexSockets(server: Server) {
	const sockets = new Set<Duplex>();
	const failures: Error[] = [];
	function add(socket: Duplex) {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
		socket.on("end", () => socket.destroy());
		socket.on("error", (error: NodeJS.ErrnoException) => {
			if (error.code !== "ECONNRESET" && error.code !== "EPIPE") {
				failures.push(error);
			}
			socket.destroy();
		});
	}
	async function close() {
		for (const socket of sockets) {
			socket.destroy();
		}
		await new Promise<void>((resolve) => server.close(() => resolve()));
		if (failures.length > 0) {
			throw new AggregateError(failures, "Unexpected synthetic Codex socket failure");
		}
	}
	return { add, close, sockets };
}
