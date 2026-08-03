import type { IncomingMessage } from "node:http";

interface NodeRequestCarrier {
	readonly runtime?: {
		readonly node?: {
			readonly req?: IncomingMessage;
		};
	};
}

export interface NodeSubscriptionSignalOptions {
	/** A Web request, including its signal and an optional srvx node runtime. */
	readonly request?: Request | undefined;
	/** The node request when the transport exposes it directly. */
	readonly nodeRequest?: IncomingMessage | undefined;
	/** Additional transport or procedure signals to combine. */
	readonly signals?: Iterable<AbortSignal | undefined>;
}

export interface NodeSubscriptionSignal {
	/** Detach node listeners when the subscription ends. */
	readonly dispose: () => void;
	/** Aborts when any supplied signal or the underlying connection closes. */
	readonly signal: AbortSignal;
}

const nodeRequestFrom = (
	request: Request | undefined,
): IncomingMessage | undefined =>
	(request as (Request & NodeRequestCarrier) | undefined)?.runtime?.node?.req;

/**
 * Combine Web/procedure abort signals with node request and socket close events.
 * The node events cover long-lived responses under Bun's node:http compatibility
 * layer, where a Web request signal alone may not report an abandoned socket.
 */
export const nodeSubscriptionSignal = (
	options: NodeSubscriptionSignalOptions,
): NodeSubscriptionSignal => {
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
