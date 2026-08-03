import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { nodeSubscriptionSignal } from "../src/node-http.js";

const makeNodeRequest = (complete = false) => {
	const socket = new EventEmitter() as EventEmitter & { destroyed: boolean };
	socket.destroyed = false;
	const request = new EventEmitter() as EventEmitter & {
		complete: boolean;
		destroyed: boolean;
		socket: typeof socket;
	};
	request.complete = complete;
	request.destroyed = false;
	request.socket = socket;
	return { request: request as unknown as IncomingMessage, socket };
};

const webRequestCarrying = (nodeRequest: IncomingMessage): Request => {
	const request = new Request("http://localhost/api/trpc/live");
	Object.defineProperty(request, "runtime", {
		value: { node: { req: nodeRequest } },
	});
	return request;
};

describe("nodeSubscriptionSignal", () => {
	it("aborts on socket close from an explicit node request", () => {
		const { request, socket } = makeNodeRequest();
		const subscription = nodeSubscriptionSignal({ nodeRequest: request });
		expect(subscription.signal.aborted).toBe(false);
		socket.emit("close");
		expect(subscription.signal.aborted).toBe(true);
	});

	it("finds the node request carried by a srvx Web request", () => {
		const { request } = makeNodeRequest();
		const subscription = nodeSubscriptionSignal({
			request: webRequestCarrying(request),
		});
		request.emit("close");
		expect(subscription.signal.aborted).toBe(true);
	});

	it("ignores normal completed request close", () => {
		const { request } = makeNodeRequest(true);
		const subscription = nodeSubscriptionSignal({ nodeRequest: request });
		request.emit("close");
		expect(subscription.signal.aborted).toBe(false);
	});

	it("aborts immediately for an already destroyed connection", () => {
		const { request, socket } = makeNodeRequest();
		socket.destroyed = true;
		const subscription = nodeSubscriptionSignal({ nodeRequest: request });
		expect(subscription.signal.aborted).toBe(true);
	});

	it("combines Web and additional abort signals", () => {
		const procedure = new AbortController();
		const subscription = nodeSubscriptionSignal({
			request: new Request("http://localhost/api/trpc/live"),
			signals: [undefined, procedure.signal],
		});
		procedure.abort();
		expect(subscription.signal.aborted).toBe(true);
	});

	it("disposes node listeners idempotently", () => {
		const { request, socket } = makeNodeRequest();
		const subscription = nodeSubscriptionSignal({ nodeRequest: request });
		expect(request.listenerCount("close")).toBe(1);
		expect(socket.listenerCount("close")).toBe(1);
		subscription.dispose();
		subscription.dispose();
		expect(request.listenerCount("close")).toBe(0);
		expect(socket.listenerCount("close")).toBe(0);
		socket.emit("close");
		expect(subscription.signal.aborted).toBe(false);
	});
});
