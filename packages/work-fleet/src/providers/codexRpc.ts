import { Effect, Schedule, Schema } from "effect";
import { NAME, TITLE, VERSION } from "#packageInfo.ts";
import { capacity } from "#providers/capacity.ts";
import { Envelope } from "#providers/codexProtocol.ts";
import { genericRejection } from "#providers/genericRejection.ts";
import { SessionFailure } from "#session/schema.ts";

type Resume = (result: Effect.Effect<unknown, SessionFailure>) => void;
const RpcError = Schema.Struct({ code: Schema.optional(Schema.Number), message: Schema.String });
function rejection(error: unknown) {
	const decoded = Schema.decodeUnknownOption(RpcError)(error);
	return new SessionFailure({
		capacity: capacity(error),
		code: decoded._tag === "Some" && decoded.value.code === -32_001 ? "session-queue-full" : "session-rejected",
		message:
			decoded._tag === "Some" ? `Codex rejected the protocol request: ${decoded.value.message.slice(0, 500)}` : "Codex rejected the protocol request",
		reason: "rejected",
	});
}
export interface CodexConnection {
	readonly closed: {
		value: boolean;
	};
	readonly nextId: {
		value: number;
	};
	readonly pending: Map<number, Resume>;
	readonly socket: WebSocket;
}
export function failure(reason: SessionFailure["reason"], message: string) {
	return new SessionFailure({ message, reason });
}
function failPending(connection: CodexConnection, error: SessionFailure) {
	for (const pending of connection.pending.values()) {
		pending(Effect.fail(error));
	}
	connection.pending.clear();
}
export interface CodexEndpoint {
	readonly protocols?: readonly string[];
	readonly url: URL;
}
function openSocket(endpoint: CodexEndpoint) {
	return Effect.callback<CodexConnection, SessionFailure>((resume) => {
		let socket: WebSocket;
		try {
			socket = new WebSocket(endpoint.url, endpoint.protocols === undefined ? undefined : [...endpoint.protocols]);
		} catch {
			resume(Effect.fail(failure("unavailable", "Invalid Codex endpoint")));
			return;
		}
		const connection: CodexConnection = { closed: { value: false }, nextId: { value: 0 }, pending: new Map(), socket };
		function disconnected() {
			connection.closed.value = true;
			for (const pending of connection.pending.values()) {
				pending(
					Effect.fail(
						new SessionFailure({
							code: "session-unavailable",
							message: "Codex disconnected; reconcile persisted submission before retrying",
							reason: "ambiguous",
						}),
					),
				);
			}
			connection.pending.clear();
		}
		socket.addEventListener("close", disconnected);
		socket.addEventListener("error", () => {
			disconnected();
			resume(Effect.fail(failure("unavailable", "Could not connect to the configured Codex endpoint")));
		});
		socket.addEventListener("open", () => resume(Effect.succeed(connection)), { once: true });
		socket.addEventListener("message", (event) => {
			try {
				const envelope = Schema.decodeUnknownSync(Envelope)(JSON.parse(String(event.data)));
				if (envelope.method !== undefined && envelope.id !== undefined) {
					// A provider request cannot grant itself execution or delivery authority.
					socket.send(JSON.stringify({ error: { code: -32_601, message: "Fleet transport has no approval handler" }, id: envelope.id }));
					return;
				}
				if (typeof envelope.id !== "number") {
					return;
				}
				const pending = connection.pending.get(envelope.id);
				connection.pending.delete(envelope.id);
				pending?.(envelope.error === undefined ? Effect.succeed(envelope.result) : Effect.fail(rejection(envelope.error)));
			} catch {
				failPending(connection, failure("protocol", "Codex returned an invalid protocol envelope"));
			}
		});
		return Effect.sync(() => socket.close());
	});
}
export function connect(endpoint: CodexEndpoint, timeoutMs: number) {
	return Effect.acquireRelease(
		openSocket(endpoint).pipe(
			Effect.timeout(`${timeoutMs} millis`),
			Effect.catchTag("TimeoutError", () => Effect.fail(failure("unavailable", "Codex connection timed out"))),
		),
		(connection) => Effect.sync(() => connection.socket.close()),
	);
}
export function initialize(connection: CodexConnection, timeoutMs: number, experimentalApi: boolean) {
	return request(connection, timeoutMs, "initialize", {
		capabilities: experimentalApi ? { experimentalApi } : null,
		clientInfo: { name: NAME, title: TITLE, version: VERSION },
	}).pipe(Effect.andThen(Effect.sync(() => connection.socket.send(JSON.stringify({ method: "initialized" })))));
}
export function request(connection: CodexConnection, timeoutMs: number, method: string, params: unknown, mutation = false) {
	return Effect.callback<unknown, SessionFailure>((resume) => {
		if (connection.closed.value) {
			resume(Effect.fail(failure("unavailable", "Codex connection is closed")));
			return;
		}
		connection.nextId.value += 1;
		const id = connection.nextId.value;
		connection.pending.set(id, resume);
		try {
			connection.socket.send(JSON.stringify({ id, method, params }));
		} catch {
			connection.pending.delete(id);
			resume(Effect.fail(failure(mutation ? "ambiguous" : "unavailable", "Codex write failed")));
		}
		return Effect.sync(() => {
			connection.pending.delete(id);
		});
	}).pipe(
		Effect.timeout(`${timeoutMs} millis`),
		Effect.catchTag("TimeoutError", () =>
			Effect.fail(failure(mutation ? "ambiguous" : "unavailable", "Codex request timed out; preserve submission ownership")),
		),
		Effect.retry({ schedule: Schedule.exponential("30 seconds"), times: 2, while: genericRejection }),
	);
}
export function decode<A, TEncoded>(schema: Schema.Codec<A, TEncoded>, value: unknown) {
	return Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError(() => failure("protocol", "Codex returned an incompatible protocol response")),
	);
}
