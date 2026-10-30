import type { BrowserWindow } from "happy-dom";

export class RpcStream {
	blocked = false;
	readonly sockets: InstanceType<BrowserWindow["WebSocket"]>[] = [];
	readonly subscriptions = new Set<string | number>();
	readonly window: BrowserWindow;
	constructor(window: BrowserWindow) {
		this.window = window;
	}
	attach(socket: InstanceType<BrowserWindow["WebSocket"]>) {
		this.sockets.push(socket);
		if (this.blocked) {
			socket.addEventListener("open", () => socket.close());
		}
	}
	urls() {
		return this.sockets.map((socket) => socket.url);
	}
	close() {
		for (const socket of this.sockets) {
			socket.close();
		}
	}
	connect() {
		this.blocked = false;
	}
	drop() {
		this.blocked = true;
		this.close();
	}
	emit(name: string) {
		if (name !== "change") {
			throw new Error(`Unsupported live event ${name}`);
		}
		const socket = this.sockets.at(-1);
		if (!socket) {
			throw new Error("The RPC socket has no connected reader");
		}
		for (const requestId of this.subscriptions) {
			socket.dispatchEvent(
				new this.window.MessageEvent("message", {
					data: `${JSON.stringify({ _tag: "Chunk", requestId, values: [{ _tag: "Resync" }] })}\n`,
				}),
			);
		}
	}
}
