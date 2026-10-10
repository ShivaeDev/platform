import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Effect, Layer, Schema } from "effect";
import { CodexLocalConfig, codexLocalLayer } from "#providers/codexLocal.ts";

const WireRequest = Schema.Struct({ id: Schema.optional(Schema.Number), method: Schema.String, params: Schema.optional(Schema.Unknown) });
export type WireRequest = typeof WireRequest.Type;
const Params = Schema.Struct({ cursor: Schema.optional(Schema.NullOr(Schema.String)) });
export function requestCursor(request: WireRequest) {
	return Schema.decodeUnknownSync(Params)(request.params).cursor;
}
export function codexConfiguration(endpoint: string) {
	return codexLocalLayer.pipe(Layer.provide(Layer.succeed(CodexLocalConfig)({ endpoint, requestTimeoutMs: 1000 })));
}

function frame(value: unknown) {
	const body = Buffer.from(JSON.stringify(value));
	if (body.length < 126) {
		return Buffer.concat([Buffer.from([129, body.length]), body]);
	}
	const header = Buffer.alloc(4);
	header[0] = 129;
	header[1] = 126;
	header.writeUInt16BE(body.length, 2);
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
// This synthetic server proves local wire handling; it supplies no provider execution evidence.
export function codexServer(handle: (request: WireRequest) => unknown) {
	return Effect.acquireRelease(
		Effect.tryPromise(async () => {
			const server = createServer();
			server.on("upgrade", (request, socket) => {
				const accept = createHash("sha1").update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
				socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
				let buffered = Buffer.alloc(0);
				socket.on("data", (chunk: Buffer) => {
					buffered = Buffer.concat([buffered, chunk]);
					for (let parsed = nextFrame(buffered); parsed !== undefined; parsed = nextFrame(buffered)) {
						if (parsed.opcode === 8) {
							socket.end(Buffer.from([136, 0]));
							return;
						}
						buffered = buffered.subarray(parsed.consumed);
						const message = Schema.decodeUnknownSync(WireRequest)(JSON.parse(parsed.body.toString()));
						const result = handle(message);
						if (message.id !== undefined && result !== undefined) {
							socket.write(frame({ id: message.id, result }));
						}
					}
				});
			});
			await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
			const address = server.address();
			if (address === null || typeof address === "string") {
				throw new Error("No synthetic server address");
			}
			return { endpoint: `ws://127.0.0.1:${address.port}`, server };
		}),
		({ server }) => Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve()))),
	);
}
