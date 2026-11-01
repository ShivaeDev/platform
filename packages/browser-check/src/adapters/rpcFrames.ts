import { Schema } from "effect";
import { RpcSerialization } from "effect/rpc";

const RequestId = Schema.Union([Schema.String, Schema.Number]);
const chunk = Schema.is(Schema.Struct({ _tag: Schema.Literal("Chunk"), requestId: RequestId, values: Schema.Array(Schema.Unknown) }));
const resync = Schema.is(Schema.Struct({ _tag: Schema.Literal("Resync") }));
const changed = Schema.is(Schema.Struct({ _tag: Schema.Literal("Changed"), keys: Schema.Array(Schema.Unknown) }));
const listRequest = Schema.is(
	Schema.Struct({
		_tag: Schema.Literal("Request"),
		headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
		id: RequestId,
		payload: Schema.Unknown,
		tag: Schema.Literal("notes.list"),
	}),
);

function rpcFrame(payload: string | Buffer, matches: (message: unknown) => boolean): boolean {
	try {
		return RpcSerialization.ndjson.makeUnsafe().decode(`${payload}\n`).some(matches);
	} catch {
		return false;
	}
}

export function rpcHint(payload: string | Buffer, tag: "Resync" | "Changed"): boolean {
	return rpcFrame(payload, (message) => chunk(message) && message.values.some(tag === "Resync" ? resync : changed));
}

export function rpcListRequest(payload: string | Buffer): boolean {
	return rpcFrame(payload, listRequest);
}
