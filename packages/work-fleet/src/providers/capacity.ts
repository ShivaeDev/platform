import { Schema } from "effect";
import { ProviderCapacity } from "#session/schema.ts";

const ErrorData = Schema.Struct({ data: Schema.Struct({ codexErrorInfo: ProviderCapacity }) });
export function capacity(error: unknown) {
	const decoded = Schema.decodeUnknownOption(ErrorData)(error);
	return decoded._tag === "Some" ? decoded.value.data.codexErrorInfo : undefined;
}
