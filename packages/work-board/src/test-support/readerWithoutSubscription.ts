import type { BrowserWindow } from "happy-dom";
import { readerAt } from "./boardStory.ts";

function bodyText(body: unknown) {
	if (typeof body === "string") {
		return body;
	}
	return body instanceof Uint8Array ? new TextDecoder().decode(body) : "";
}

function refuseSubscription(window: BrowserWindow) {
	const native = window.fetch.bind(window);
	window.fetch = (input, init) =>
		bodyText(init?.body).includes("work-board.subscribe") ? Promise.reject(new TypeError("Failed to fetch")) : native(input, init);
}

export function readerWithoutSubscription(path: string) {
	return readerAt(path, refuseSubscription);
}
