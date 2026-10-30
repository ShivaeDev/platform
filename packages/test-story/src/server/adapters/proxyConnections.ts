import type { Duplex } from "node:stream";

export function proxyConnections() {
	const sockets = new Set<Duplex>();
	let mode: "online" | "held" | "offline" = "online";
	let reconnected: (() => void) | undefined;
	function close() {
		for (const socket of sockets) {
			socket.destroy();
		}
	}
	function firstFrame() {
		reconnected?.();
		reconnected = undefined;
	}
	function track(socket: Duplex) {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
		if (mode === "held") {
			socket.pause();
		} else if (mode === "offline") {
			socket.destroy();
		}
	}
	return {
		close,
		disconnect: () => {
			mode = "offline";
			const nextFrame = new Promise<void>((resolve) => {
				reconnected = resolve;
			});
			close();
			return nextFrame;
		},
		hold: () => {
			mode = "held";
			for (const socket of sockets) {
				socket.pause();
			}
		},
		online: () => {
			mode = "online";
			for (const socket of sockets) {
				socket.resume();
			}
		},
		track,
		upgrade: (downstream: Duplex, upstream: Duplex, head: Buffer, upstreamHead: Buffer) => {
			track(upstream);
			downstream.once("data", firstFrame);
			if (head.length > 0) {
				firstFrame();
			}
			downstream.write(upstreamHead);
			upstream.write(head);
			downstream.pipe(upstream).pipe(downstream);
			downstream.on("close", () => upstream.destroy());
			upstream.on("close", () => downstream.destroy());
			upstream.on("error", () => downstream.destroy());
			if (mode === "held") {
				downstream.pause();
				upstream.pause();
			}
		},
	};
}
