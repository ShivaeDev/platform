import type { BrowserWindow } from "happy-dom";
import { held } from "./browser.ts";

export function historyObservation() {
	const gate = held();
	const started = Promise.withResolvers<() => boolean>();
	function install(window: BrowserWindow) {
		const fetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			if (input === "/_board/history" && typeof init?.body === "string" && init.body.includes('"action":"observe"')) {
				started.resolve(() => init.signal?.aborted ?? false);
				await gate.gate;
			}
			return fetch(input, init);
		};
	}
	return { install, release: gate.release, started: started.promise };
}
