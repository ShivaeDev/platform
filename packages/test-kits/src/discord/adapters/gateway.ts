import { Effect, Queue, Schema } from "effect";
import { Socket } from "effect/socket";
import { GatewayTransport } from "@shivaedev/discord/GatewayTransport.ts";

const Frame = Schema.Struct({ d: Schema.Unknown, op: Schema.Number });
const Resume = Schema.Struct({ seq: Schema.Number, sessionId: Schema.String }).pipe(Schema.encodeKeys({ sessionId: "session_id" }));

export const discordGateway = Effect.fnUntraced(function* () {
	const sent = yield* Queue.unbounded<typeof Frame.Type>();
	const closures = yield* Queue.unbounded<void>();
	const frames: (typeof Frame.Type)[] = [];
	const urls: string[] = [];
	const events: { d: unknown; op: number; s: number; t: string }[] = [];
	let active: Queue.Queue<string, Socket.SocketError> | undefined;
	let sequence = 0;
	let sessionId = "";
	let sessions = 0;
	let closed = 0;
	let acknowledge = true;
	const encode = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
	function emit(frame: unknown) {
		if (active !== undefined) {
			Queue.offerUnsafe(active, encode(frame));
		}
	}
	function dispatch(type: string, data: unknown) {
		sequence += 1;
		const event = { d: data, op: 0, s: sequence, t: type };
		events.push(event);
		emit(event);
	}
	function identify() {
		sessions += 1;
		sessionId = `session-${sessions}`;
		dispatch("READY", { "resume_gateway_url": "wss://resume.discord.test", "session_id": sessionId });
	}
	function resumeSession(data: unknown) {
		const resume = Schema.decodeUnknownSync(Resume)(data);
		if (resume.sessionId !== sessionId || resume.seq > sequence) {
			emit({ d: false, op: 9 });
			return;
		}
		for (const event of events.filter((candidate) => candidate.s > resume.seq)) {
			emit(event);
		}
		dispatch("RESUMED", {});
	}
	function receive(raw: Uint8Array | string | Socket.CloseEvent) {
		if (typeof raw !== "string") {
			return;
		}
		const frame = Schema.decodeUnknownSync(Schema.fromJsonString(Frame))(raw);
		frames.push(frame);
		Queue.offerUnsafe(sent, frame);
		switch (frame.op) {
			case 2:
				identify();
				break;
			case 6:
				resumeSession(frame.d);
				break;
			case 1:
				if (acknowledge) {
					emit({ d: null, op: 11 });
				}
				break;
		}
	}
	function reader(incoming: Queue.Queue<string, Socket.SocketError>, url: string) {
		return Effect.acquireRelease(
			Effect.sync(() => {
				urls.push(url);
				active = incoming;
				emit({ d: { "heartbeat_interval": 30_000 }, op: 10 });
				return { pull: Queue.take(incoming).pipe(Effect.map((frame) => [frame] as const)), upgrade: Socket.SocketUpgradeError.unsupported };
			}),
			() =>
				Effect.gen(function* () {
					closed += 1;
					yield* Queue.offer(closures, undefined);
					if (active === incoming) {
						active = undefined;
					}
					yield* Queue.fail(incoming, new Socket.SocketError({ reason: new Socket.SocketCloseError({ code: 1000 }) }));
				}),
		);
	}
	const transport = GatewayTransport.of({
		open: (url) =>
			Effect.gen(function* () {
				const incoming = yield* Queue.unbounded<string, Socket.SocketError>();
				function write(raw: Uint8Array | string | Socket.CloseEvent) {
					return Effect.sync(() => receive(raw));
				}
				return Socket.make({
					reader: reader(incoming, url),
					writer: Effect.succeed({ write, writeAll: (chunks) => Effect.forEach(chunks, write, { discard: true }) }),
				});
			}),
	});
	return {
		closed: () => closed,
		dispatch: (type: string, data: unknown) => Effect.sync(() => dispatch(type, data)),
		drop: (code = 1006) =>
			Effect.gen(function* () {
				if (active !== undefined) {
					yield* Queue.fail(active, new Socket.SocketError({ reason: new Socket.SocketCloseError({ code }) }));
				}
				active = undefined;
			}),
		frames,
		invalidate: (resumable: boolean) => Effect.sync(() => emit({ d: resumable, op: 9 })),
		malformedFrame: () =>
			Effect.sync(() => {
				if (active !== undefined) {
					Queue.offerUnsafe(active, "not json");
				}
			}),
		nextClosed: Queue.take(closures),
		nextSent: Queue.take(sent),
		requestReconnect: () => Effect.sync(() => emit({ d: null, op: 7 })),
		stopAcknowledging: () =>
			Effect.sync(() => {
				acknowledge = false;
			}),
		transport,
		urls,
	};
});
