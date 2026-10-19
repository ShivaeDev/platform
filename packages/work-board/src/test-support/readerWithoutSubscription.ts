import type { BrowserWindow } from "happy-dom";
import { readerAt } from "./boardStory.ts";

function refuseSubscription(window: BrowserWindow) {
	const native = window.fetch.bind(window);
	window.fetch = (input, init) => {
		const body = init?.body;
		const text = typeof body === "string" ? body : body instanceof Uint8Array ? new TextDecoder().decode(body) : "";
		return text.includes("work-board.subscribe") ? Promise.reject(new TypeError("Failed to fetch")) : native(input, init);
	};
}

export function readerWithoutSubscription(path: string) {
	return readerAt(path, refuseSubscription);
}
