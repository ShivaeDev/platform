import { Cause, Effect, Queue } from "effect";
import type { Page, WebSocket } from "playwright";
import { BrowserCheckError } from "#BrowserCheckError.ts";
import type { BrowserSocket } from "#BrowserSocket.ts";

export const watchSocket = Effect.fn("BrowserCheck.watchSocket")(function* (page: Page, url: string) {
	const messages = yield* Queue.unbounded<string | Uint8Array, BrowserCheckError>();
	function fail(message: string) {
		Queue.failCauseUnsafe(messages, Cause.fail(new BrowserCheckError({ message })));
	}
	function received({ payload }: { readonly payload: string | Buffer }) {
		Queue.offerUnsafe(messages, payload);
	}
	function closed() {
		fail(`Live socket ${url} closed.`);
	}
	function socketError(error: string) {
		fail(`Live socket ${url}: ${error}`);
	}
	let socket: WebSocket | undefined;
	function connected(candidate: WebSocket) {
		if (candidate.url() !== url) {
			return;
		}
		socket = candidate;
		page.off("websocket", connected);
		candidate.on("framereceived", received);
		candidate.on("close", closed);
		candidate.on("socketerror", socketError);
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => {
			page.on("websocket", connected);
			page.on("close", closed);
		}),
		() =>
			Effect.sync(() => {
				page.off("websocket", connected);
				page.off("close", closed);
				socket?.off("framereceived", received);
				socket?.off("close", closed);
				socket?.off("socketerror", socketError);
				Queue.shutdownUnsafe(messages);
			}),
	);
	return { nextMessage: Queue.take(messages) } satisfies BrowserSocket;
});
