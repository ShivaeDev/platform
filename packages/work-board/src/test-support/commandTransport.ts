import type { OpenPage } from "./browser.ts";
import { type RpcRequest, rpcCall } from "./rpc.ts";

export function commandTransport(
	command: string,
	intercept: (call: RpcRequest) => void | Promise<void>,
): Parameters<typeof import("./browser.ts").openPage>[2] {
	return (window: OpenPage["window"]) => {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const call = await rpcCall(window, input, init);
			if (call?.tag === command) {
				await intercept(call);
			}
			return fetch(input, init);
		};
	};
}
