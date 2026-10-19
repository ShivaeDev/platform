import { Schema } from "effect";
import { RpcSerialization } from "effect/rpc";
import type { FromServerEncoded } from "effect/rpc/RpcMessage";
import type { BrowserWindow } from "happy-dom";

const Request = Schema.Struct({
	_tag: Schema.Literal("Request"),
	id: Schema.Union([Schema.String, Schema.Number]),
	payload: Schema.optional(Schema.Unknown),
	tag: Schema.String,
});
export type RpcRequest = typeof Request.Type;
async function decodeRequests(request: { clone: () => { text: () => Promise<string> } }): Promise<readonly RpcRequest[]> {
	const body = await request.clone().text();
	return RpcSerialization.ndjson
		.makeUnsafe()
		.decode(body)
		.flatMap((message) => {
			const result = Schema.decodeUnknownResult(Request)(message);
			return result._tag === "Success" ? [result.success] : [];
		});
}
const requests = new WeakMap<object, Promise<readonly RpcRequest[]>>();
export function rpcRequests(request: { clone: () => { text: () => Promise<string> } }) {
	let decoded = requests.get(request);
	if (decoded === undefined) {
		decoded = decodeRequests(request);
		requests.set(request, decoded);
	}
	return decoded;
}
export async function rpcRequest(request: { clone: () => { text: () => Promise<string> } }): Promise<RpcRequest | undefined> {
	return (await rpcRequests(request))[0];
}
export function rpcResponse(window: BrowserWindow, request: RpcRequest, value: unknown) {
	const message: FromServerEncoded = { _tag: "Exit", exit: { _tag: "Success", value }, requestId: request.id };
	return new window.Response(RpcSerialization.ndjson.makeUnsafe().encode(message), { headers: { "content-type": "application/ndjson" } });
}

export function rpcFailure(window: BrowserWindow, request: RpcRequest, error: unknown) {
	const message: FromServerEncoded = { _tag: "Exit", exit: { _tag: "Failure", cause: [{ _tag: "Fail", error }] }, requestId: request.id };
	return new window.Response(RpcSerialization.ndjson.makeUnsafe().encode(message), { headers: { "content-type": "application/ndjson" } });
}

export async function rpcCall(window: BrowserWindow, input: Parameters<BrowserWindow["fetch"]>[0], init?: Parameters<BrowserWindow["fetch"]>[1]) {
	const request = new window.Request(input, init);
	if (new URL(request.url).pathname.replace(/\/$/u, "") !== "/_board/rpc") {
		return undefined;
	}
	return await rpcRequest(request);
}
