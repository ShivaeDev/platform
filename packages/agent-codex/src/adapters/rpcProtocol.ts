import { Schema } from "effect";
import { ProtocolFailure, Rejected } from "@shivaedev/agent/failures.ts";
export const Envelope = Schema.Struct({
	error: Schema.optional(Schema.Unknown),
	id: Schema.optional(Schema.Union([Schema.Number, Schema.String])),
	method: Schema.optional(Schema.String),
	params: Schema.optional(Schema.Unknown),
	result: Schema.optional(Schema.Unknown),
});
const RpcError = Schema.Struct({
	code: Schema.optional(Schema.Number),
	data: Schema.optional(Schema.Struct({ codexErrorInfo: Schema.optional(Schema.Unknown) })),
	message: Schema.String,
});
const Capacity = Schema.Literals(["rateLimitExceeded", "flexUnavailable", "serverOverloaded", "usageLimitExceeded"]);
export function rejected(value: unknown) {
	const error = Schema.decodeUnknownOption(RpcError)(value);
	if (error._tag === "None") {
		return new ProtocolFailure({ backend: "codex", message: "Invalid Codex rejection" });
	}
	const capacity = Schema.decodeUnknownOption(Capacity)(error.value.data?.codexErrorInfo);
	const code = error.value.code === -32_001 ? "session-queue-full" : String(error.value.code ?? "rejected");
	return new Rejected({
		backend: "codex",
		message: error.value.message,
		providerCode: capacity._tag === "Some" ? capacity.value : code,
	});
}
