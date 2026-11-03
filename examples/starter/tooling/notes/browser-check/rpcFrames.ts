import { Option, Schema } from "effect";

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

const decodeMessage = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

function rpcFrame(payload: string, matches: (message: unknown) => boolean): boolean {
	return payload.split("\n").some((line) => {
		const decoded = decodeMessage(line);
		return Option.isSome(decoded) && matches(decoded.value);
	});
}

export function rpcHint(payload: string, tag: "Resync" | "Changed"): boolean {
	return rpcFrame(payload, (message) => chunk(message) && message.values.some(tag === "Resync" ? resync : changed));
}

export function rpcListRequest(payload: string): boolean {
	return rpcFrame(payload, listRequest);
}
