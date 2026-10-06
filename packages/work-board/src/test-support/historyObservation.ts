import type { BrowserWindow } from "happy-dom";
import { held } from "./browser.ts";
import { rpcCall } from "./rpc.ts";

export function historyObservation() {
	const gate = held();
	const started = Promise.withResolvers<() => boolean>();
	function install(window: BrowserWindow) {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			const call = await rpcCall(window, input, init);
			if (call?.tag === "work-board.history" && JSON.stringify(call.payload).includes('"action":"observe"')) {
				started.resolve(() => init?.signal?.aborted ?? false);
				await gate.gate;
			}
			return fetch(input, init);
		};
	}
	return { install, release: gate.release, started: started.promise };
}
