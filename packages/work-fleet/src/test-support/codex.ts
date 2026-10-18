import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { Effect, Layer, Schema } from "effect";
import { CodexLocalConfig, codexLocalLayer } from "#providers/codexLocal.ts";
import { codexSockets } from "./codexSockets.ts";

const WireRequest = Schema.Struct({ id: Schema.optional(Schema.Number), method: Schema.String, params: Schema.optional(Schema.Unknown) });
export type WireRequest = typeof WireRequest.Type;
const Params = Schema.Struct({ cursor: Schema.optional(Schema.NullOr(Schema.String)) });
export function requestCursor(request: WireRequest) {
	return Schema.decodeUnknownSync(Params)(request.params).cursor;
}
export function codexConfiguration(endpoint: string, requestTimeoutMs = 1000) {
	return codexLocalLayer.pipe(Layer.provide(Layer.succeed(CodexLocalConfig)({ endpoint, requestTimeoutMs })));
}

function frame(value: unknown) {
	const body = Buffer.from(JSON.stringify(value));
	if (body.length < 126) {
		return Buffer.concat([Buffer.from([129, body.length]), body]);
	}
	const header = Buffer.alloc(body.length < 65_536 ? 4 : 10);
	header[0] = 129;
	header[1] = body.length < 65_536 ? 126 : 127;
	if (body.length < 65_536) {
		header.writeUInt16BE(body.length, 2);
	} else {
		header.writeBigUInt64BE(BigInt(body.length), 2);
	}
	return Buffer.concat([header, body]);
}
function nextFrame(buffered: Buffer) {
	if (buffered.length < 2) {
		return undefined;
	}
	const opcode = buffered.readUInt8(0) & 15;
	if (opcode === 8) {
		return { body: Buffer.alloc(0), consumed: 2, opcode };
	}
	let length = buffered.readUInt8(1) & 127;
	let offset = 2;
	if (length === 126) {
		if (buffered.length < 4) {
			return undefined;
		}
		length = buffered.readUInt16BE(2);
		offset = 4;
	}
	if (buffered.length < offset + 4 + length) {
		return undefined;
	}
	const mask = buffered.subarray(offset, offset + 4);
	const body = Buffer.from(buffered.subarray(offset + 4, offset + 4 + length));
	for (let index = 0; index < body.length; index += 1) {
		body.writeUInt8(body.readUInt8(index) ^ mask.readUInt8(index % 4), index);
	}
	return { body, consumed: offset + 4 + length, opcode };
}
async function respond(handle: (request: WireRequest) => unknown, body: Buffer) {
	const message = Schema.decodeUnknownSync(WireRequest)(JSON.parse(body.toString()));
	const result = await handle(message);
	if (message.id === undefined || result === undefined) {
		return undefined;
	}
	return result instanceof WireRejection
		? { error: { code: result.code, ...(result.data === undefined ? {} : { data: result.data }), message: result.message }, id: message.id }
		: { id: message.id, result };
}
function sendReply(socket: Duplex, handle: (request: WireRequest) => unknown, body: Buffer) {
	respond(handle, body)
		.then((reply) => {
			if (reply !== undefined && !socket.destroyed) {
				socket.write(frame(reply));
			}
		})
		.catch(() => socket.destroy());
}
function offeredProtocols(header: string | undefined) {
	return (header ?? "")
		.split(",")
		.map((protocol) => protocol.trim())
		.filter(Boolean);
}
export class WireRejection {
	readonly code: number;
	readonly message: string;
	readonly data: unknown;
	constructor(message: string, data?: unknown, code = -32_602) {
		this.code = code;
		this.message = message;
		this.data = data;
	}
}
export interface Handshake {
	readonly protocols: readonly string[];
}
// This synthetic server proves wire handling; it supplies no provider execution evidence.
export function codexServer(handle: (request: WireRequest) => unknown, handshakes: Handshake[] = []) {
	return Effect.acquireRelease(
		Effect.tryPromise(async () => {
			const server = createServer();
			const connections = codexSockets(server);
			server.on("upgrade", (request, socket) => {
				connections.add(socket);
				const accept = createHash("sha1").update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
				const protocols = offeredProtocols(request.headers["sec-websocket-protocol"]);
				handshakes.push({ protocols });
				const selected = protocols[0] === undefined ? "" : `Sec-WebSocket-Protocol: ${protocols[0]}\r\n`;
				socket.write(
					`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n${selected}\r\n`,
				);
				let buffered = Buffer.alloc(0);
				socket.on("data", (chunk: Buffer) => {
					buffered = Buffer.concat([buffered, chunk]);
					for (let parsed = nextFrame(buffered); parsed !== undefined; parsed = nextFrame(buffered)) {
						if (parsed.opcode === 8) {
							socket.end(Buffer.from([136, 0]));
							return;
						}
						buffered = buffered.subarray(parsed.consumed);
						sendReply(socket, handle, parsed.body);
					}
				});
			});
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			const address = server.address();
			if (address === null || typeof address === "string") {
				throw new Error("No synthetic server address");
			}
			return { close: connections.close, endpoint: `ws://127.0.0.1:${address.port}`, server, sockets: connections.sockets };
		}),
		({ close }) => Effect.promise(close),
	);
}
