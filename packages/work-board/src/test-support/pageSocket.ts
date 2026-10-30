import type { BrowserWindow } from "happy-dom";
import type { PageRequests } from "#test/browser.ts";
import { pageRead } from "#test/pageRead.ts";
import { RpcStream } from "#test/RpcStream.ts";
import { rpcRequests } from "#test/rpc.ts";

export function pageSocket(window: BrowserWindow, path: string, requests: PageRequests, streams: RpcStream[]) {
	const Native = window.WebSocket;
	const stream = new RpcStream(window);
	streams.push(stream);
	const reading = new Set<string | number>();
	const Boundary = class extends Native {
		constructor(url: string, protocols?: string | string[]) {
			super(url, protocols);
			stream.attach(this);
			this.addEventListener("message", (event) => {
				if (!(event instanceof window.MessageEvent) || typeof event.data !== "string") {
					return;
				}
				for (const line of event.data.trim().split("\n")) {
					const message = JSON.parse(line);
					if (message._tag === "Exit" && reading.delete(message.requestId)) {
						requests.answered += 1;
					}
				}
			});
		}
		override send(data: Parameters<InstanceType<BrowserWindow["WebSocket"]>["send"]>[0]) {
			if (typeof data !== "string") {
				super.send(data);
				return;
			}
			void rpcRequests({ clone: () => ({ text: async () => data }) }).then(async (calls) => {
				for (const call of calls) {
					requests.methods.push(call.tag);
					requests.calls.push(call);
					if (call.tag.endsWith(".$changes")) {
						stream.subscriptions.add(call.id);
					}
					if (pageRead(call, path)) {
						requests.count += 1;
						reading.add(call.id);
					}
					await requests.held.get(call.tag);
				}
				if (this.readyState === Native.OPEN) {
					super.send(data);
				}
			});
		}
	};
	Object.defineProperty(window, "WebSocket", { value: Boundary });
}
