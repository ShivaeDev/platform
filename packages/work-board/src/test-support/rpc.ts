import { Schema } from "effect";
import { RpcSerialization } from "effect/unstable/rpc";
import type { FromServerEncoded } from "effect/unstable/rpc/RpcMessage";
import type { BrowserWindow } from "happy-dom";

const Request = Schema.Struct({
	_tag: Schema.Literal("Request"),
	id: Schema.Union([Schema.String, Schema.Number]),
	payload: Schema.optional(Schema.Unknown),
	tag: Schema.String,
});
export type RpcRequest = typeof Request.Type;
async function decodeRequest(request: { clone: () => { text: () => Promise<string> } }): Promise<RpcRequest | undefined> {
	const body = await request.clone().text();
	const messages = RpcSerialization.ndjson.makeUnsafe().decode(body);
	for (const message of messages) {
		const result = Schema.decodeUnknownResult(Request)(message);
		if (result._tag === "Success") {
			return result.success;
		}
	}
	return undefined;
}
const requests = new WeakMap<object, Promise<RpcRequest | undefined>>();
export function rpcRequest(request: { clone: () => { text: () => Promise<string> } }) {
	let decoded = requests.get(request);
	if (decoded === undefined) {
		decoded = decodeRequest(request);
		requests.set(request, decoded);
	}
	return decoded;
}
export function rpcResponse(window: BrowserWindow, request: RpcRequest, value: unknown) {
	const message: FromServerEncoded = { _tag: "Exit", exit: { _tag: "Success", value }, requestId: request.id };
	return new window.Response(RpcSerialization.ndjson.makeUnsafe().encode(message), { headers: { "content-type": "application/ndjson" } });
}

export async function rpcCall(window: BrowserWindow, input: Parameters<BrowserWindow["fetch"]>[0], init?: Parameters<BrowserWindow["fetch"]>[1]) {
	const request = new window.Request(input, init);
	if (new URL(request.url).pathname.replace(/\/$/u, "") !== "/_board/rpc") {
		return undefined;
	}
	return await rpcRequest(request);
}
