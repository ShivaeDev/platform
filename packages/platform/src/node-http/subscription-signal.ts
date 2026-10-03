import type { IncomingMessage } from "node:http";

export interface NodeSubscriptionSignalOptions {
	readonly nodeRequest?: IncomingMessage | undefined;
	readonly request?: Request | undefined;
	readonly signals?: Iterable<AbortSignal | undefined>;
}

export interface NodeSubscriptionSignal {
	readonly dispose: () => void;
	readonly signal: AbortSignal;
}

const property = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);

const isIncomingMessage = (value: unknown): value is IncomingMessage =>
	typeof property(value, "socket") === "object" && typeof property(value, "once") === "function";

const nodeRequestFrom = (request: Request | undefined): IncomingMessage | undefined => {
	const req = property(property(property(request, "runtime"), "node"), "req");
	return isIncomingMessage(req) ? req : undefined;
};

// Under Bun's node:http compatibility layer a Web request signal may miss an abandoned socket, so node close events cover long-lived responses.
export const nodeSubscriptionSignal = (options: NodeSubscriptionSignalOptions): NodeSubscriptionSignal => {
	const controller = new AbortController();
	const signals: AbortSignal[] = [controller.signal];
	if (options.request !== undefined) signals.push(options.request.signal);
	for (const signal of options.signals ?? []) {
		if (signal !== undefined) signals.push(signal);
	}

	const nodeRequest = options.nodeRequest ?? nodeRequestFrom(options.request);
	if (nodeRequest === undefined) {
		return { dispose: () => {}, signal: AbortSignal.any(signals) };
	}

	const socket = nodeRequest.socket;
	const onRequestClose = () => {
		if (!nodeRequest.complete) controller.abort();
	};
	const onSocketClose = () => controller.abort();
	nodeRequest.once("close", onRequestClose);
	socket.once("close", onSocketClose);
	if (nodeRequest.destroyed || socket.destroyed) controller.abort();

	let disposed = false;
	return {
		dispose: () => {
			if (disposed) return;
			disposed = true;
			nodeRequest.removeListener("close", onRequestClose);
			socket.removeListener("close", onSocketClose);
		},
		signal: AbortSignal.any(signals),
	};
};
