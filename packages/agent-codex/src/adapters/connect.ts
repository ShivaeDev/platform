import { Effect, Schema } from "effect";
import { type BackendFailure, BackendUnavailable, ProtocolFailure, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { LineProcess } from "#adapters/process.ts";
import type { RpcNotification } from "#rpc.ts";
import { Envelope, rejected } from "#rpcProtocol.ts";

interface Pending {
	readonly complete: (effect: Effect.Effect<unknown, BackendFailure>) => void;
	readonly operationId: string | undefined;
}
export function connect(
	child: LineProcess,
	timeoutMs: number,
	notified: (notification: RpcNotification) => void,
	serverRequest: (id: number | string, method: string, params: unknown) => void,
	exited: () => void,
) {
	const pending = new Map<number, Pending>();
	let closed = false;
	let nextId = 0;
	function send(message: unknown) {
		return child.write(JSON.stringify(message));
	}
	function unavailable() {
		return new BackendUnavailable({ backend: "codex", message: "Codex app-server exited" });
	}
	function ambiguous(operationId: string, message: string) {
		return new UnknownAcceptance({ backend: "codex", message, operationId });
	}
	child.onExit(() => {
		closed = true;
		for (const entry of pending.values()) {
			entry.complete(
				Effect.fail(
					entry.operationId === undefined
						? unavailable()
						: ambiguous(entry.operationId, "Codex disconnected after submission; reconcile before retrying"),
				),
			);
		}
		pending.clear();
		exited();
	});
	child.onLine((line) => {
		let envelope: typeof Envelope.Type;
		try {
			envelope = Schema.decodeUnknownSync(Envelope)(JSON.parse(line));
		} catch {
			for (const entry of pending.values()) {
				entry.complete(
					Effect.fail(
						entry.operationId === undefined
							? new ProtocolFailure({ backend: "codex", message: "Invalid Codex RPC envelope" })
							: ambiguous(entry.operationId, "Invalid response after mutation"),
					),
				);
			}
			pending.clear();
			return;
		}
		dispatch(envelope);
	});
	function dispatch(envelope: typeof Envelope.Type) {
		if (envelope.method !== undefined) {
			if (envelope.id === undefined) {
				notified({ method: envelope.method, params: envelope.params });
			} else {
				serverRequest(envelope.id, envelope.method, envelope.params);
			}
			return;
		}
		if (typeof envelope.id !== "number") {
			return;
		}
		const entry = pending.get(envelope.id);
		pending.delete(envelope.id);
		if (entry === undefined) {
			return;
		}
		if (envelope.error === undefined) {
			entry.complete(Effect.succeed(envelope.result));
			return;
		}
		const error = rejected(envelope.error);
		entry.complete(
			Effect.fail(
				error._tag === "ProtocolFailure" && entry.operationId !== undefined
					? ambiguous(entry.operationId, "Invalid rejection after mutation")
					: error,
			),
		);
	}

	function request(method: string, params: unknown, operationId?: string) {
		return Effect.callback<unknown, BackendFailure>((complete) => {
			if (closed) {
				complete(Effect.fail(unavailable()));
				return;
			}
			nextId += 1;
			const id = nextId;
			pending.set(id, { complete, operationId });
			try {
				send({ id, method, params });
			} catch {
				pending.delete(id);
				complete(Effect.fail(operationId === undefined ? unavailable() : ambiguous(operationId, "Codex write failed after submission")));
			}
			return Effect.sync(() => {
				pending.delete(id);
			});
		}).pipe(
			Effect.timeout(`${timeoutMs} millis`),
			Effect.catchTag("TimeoutError", () =>
				Effect.fail(
					operationId === undefined
						? new BackendUnavailable({ backend: "codex", message: `Codex ${method} timed out` })
						: ambiguous(operationId, `Codex ${method} timed out; reconcile before retrying`),
				),
			),
		);
	}
	return {
		deny: (id: number | string) => send({ error: { code: -32_601, message: "No approval handler configured" }, id }),
		notify: (method: string, params: unknown) => send({ method, params }),
		request,
		respond: (id: number | string, result: unknown) => send({ id, result }),
	};
}
