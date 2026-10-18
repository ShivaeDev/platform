import { type ClientRequest, type IncomingMessage, request } from "node:http";
import { type NodeSubscriptionSignal, nodeSubscriptionSignal } from "#server/node-http/subscriptionSignal.ts";
import { type HostState, io } from "./state.ts";

export interface SubscriptionState {
	baseline: { request: number; socket: number };
	incoming?: IncomingMessage;
	mode: "node" | "web" | "completed" | "destroyed" | "additional";
	outgoing?: ClientRequest;
	procedure: AbortController;
	ready: () => void;
	subscription?: NodeSubscriptionSignal;
}
function connectionOf(state: HostState) {
	if (state.subscription === undefined) {
		throw new Error("A subscription connection is required");
	}
	return state.subscription;
}
export function subscriptionVerbs(state: HostState) {
	return {
		aborted: () => connectionOf(state).subscription?.signal.aborted,
		abortProcedure: () => {
			connectionOf(state).procedure.abort();
		},
		completeRequest: () =>
			io(async () => {
				const incoming = connectionOf(state).incoming;
				if (incoming === undefined || incoming.closed) {
					return;
				}
				await new Promise<void>((resolve) => incoming.once("close", resolve));
			}),
		disconnect: () =>
			io(async () => {
				const connection = connectionOf(state);
				const socket = connection.incoming?.socket;
				const closed = new Promise<void>((resolve) => {
					if (socket === undefined || socket.closed) {
						resolve();
					} else {
						socket.once("close", () => resolve());
					}
				});
				connection.outgoing?.destroy();
				await closed;
			}),
		disposeSubscription: () => {
			connectionOf(state).subscription?.dispose();
		},
		listenerCounts: () => {
			const connection = connectionOf(state);
			return {
				request: (connection.incoming?.listenerCount("close") ?? 0) - connection.baseline.request,
				socket: (connection.incoming?.socket.listenerCount("close") ?? 0) - connection.baseline.socket,
			};
		},
		openSubscription: () =>
			io(async () => {
				const connection = connectionOf(state);
				const ready = Promise.withResolvers<void>();
				connection.ready = ready.resolve;
				const outgoing = request(`${state.url}/subscription`, { method: "POST" }, (response) => {
					response.on("error", () => undefined);
					response.resume();
				});
				outgoing.on("error", () => undefined);
				connection.outgoing = outgoing;
				if (connection.mode === "completed") {
					outgoing.end("done");
				} else {
					outgoing.write("partial");
				}
				await ready.promise;
			}),
	};
}

export function subscribe(connection: SubscriptionState, node: IncomingMessage) {
	connection.incoming = node;
	if (connection.mode === "destroyed") {
		node.socket.destroy();
	}
	const web = new Request("http://localhost/subscription");
	if (connection.mode === "web") {
		Object.defineProperty(web, "runtime", { value: { node: { req: node } } });
	}
	connection.baseline = { request: node.listenerCount("close"), socket: node.socket.listenerCount("close") };
	if (connection.mode === "additional") {
		return nodeSubscriptionSignal({ request: web, signals: [undefined, connection.procedure.signal] });
	}
	if (connection.mode === "web") {
		return nodeSubscriptionSignal({ request: web });
	}
	return nodeSubscriptionSignal({ nodeRequest: node });
}
