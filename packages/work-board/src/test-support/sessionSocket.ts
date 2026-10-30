import type { Window } from "happy-dom";
import { rpcRequests } from "#test/rpc.ts";
import type { ScreenEngine } from "#test/screenEngine.ts";

function incompatibleReply(data: string, requests: ReadonlySet<string | number>) {
	return `${data
		.trim()
		.split("\n")
		.map((line) => {
			const message = JSON.parse(line);
			if (requests.has(message.requestId) && message._tag === "Exit" && message.exit?._tag === "Success") {
				message.exit.value = { outdated: true };
			}
			return JSON.stringify(message);
		})
		.join("\n")}\n`;
}

export function sessionSocket(window: Window, engine: ScreenEngine) {
	const Native = window.WebSocket;
	type Socket = InstanceType<typeof Native>;
	const incompatible = new Set<string | number>();
	const sockets = new Set<Socket>();
	async function forward(socket: Socket, data: string) {
		const calls = await rpcRequests({ clone: () => ({ text: async () => data }) });
		const boundary = engine.sessionTransport;
		for (const call of calls) {
			if (call.tag !== boundary?.tag) {
				continue;
			}
			boundary.commands.push(call);
			if (boundary.incompatible) {
				incompatible.add(call.id);
			}
			await boundary.gate;
			if (boundary.offline) {
				socket.close();
				return;
			}
		}
		if (engine.serverStopped) {
			socket.close();
		} else if (socket.readyState === Native.OPEN) {
			Native.prototype.send.call(socket, data);
		}
	}
	return {
		disconnect: () => {
			for (const socket of sockets) {
				socket.close();
			}
		},
		WebSocket: class extends Native {
			constructor(url: string | URL, protocols?: string | string[]) {
				super(String(url), protocols);
				sockets.add(this);
				this.addEventListener("close", () => sockets.delete(this));
				this.addEventListener("message", (event) => {
					if (event instanceof window.MessageEvent && typeof event.data === "string" && engine.sessionTransport?.incompatible) {
						Object.defineProperty(event, "data", { value: incompatibleReply(event.data, incompatible) });
					}
				});
			}
			override send(data: Parameters<Socket["send"]>[0]) {
				if (typeof data === "string") {
					void forward(this, data);
				} else {
					super.send(data);
				}
			}
		},
	};
}
