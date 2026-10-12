import { Schema } from "effect";
import { SourceFailure } from "#diagnostics/source.ts";

const Envelope = Schema.Struct({
	error: Schema.optional(Schema.Struct({ message: Schema.String })),
	id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
	method: Schema.optional(Schema.String),
	result: Schema.optional(Schema.Unknown),
});
const Account = Schema.Struct({ account: Schema.NullOr(Schema.Struct({ type: Schema.String })) });
export type CodexReply = { readonly send: readonly unknown[] } | { readonly result: unknown } | { readonly failure: SourceFailure };

export function codexReply(line: string): CodexReply {
	try {
		const message = Schema.decodeUnknownSync(Schema.fromJsonString(Envelope))(line);
		if (message.method !== undefined && message.id !== undefined) {
			return { send: [{ error: { code: -32_601, message: "Diagnostics reader approves nothing" }, id: message.id }] };
		}
		if (!["initialize", "account", "limits"].includes(String(message.id))) {
			return { send: [] };
		}
		if (message.error !== undefined) {
			return { failure: new SourceFailure({ kind: "error", message: `Codex ${message.id}: ${message.error.message.slice(0, 500)}` }) };
		}
		switch (message.id) {
			case "initialize":
				return { send: [{ method: "initialized" }, { id: "account", method: "account/read", params: { refreshToken: false } }] };
			case "account": {
				const account = Schema.decodeUnknownSync(Account)(message.result).account;
				if (account?.type === "apiKey") {
					return { failure: new SourceFailure({ kind: "not-configured", message: "Codex usage windows are not available for API-key accounts" }) };
				}
				if (account === null) {
					return { failure: new SourceFailure({ kind: "not-configured", message: "Codex usage windows require an authenticated ChatGPT account" }) };
				}
				return { send: [{ id: "limits", method: "account/rateLimits/read", params: { excludeResetCreditDetails: true } }] };
			}
			default:
				return { result: message.result };
		}
	} catch {
		return { failure: new SourceFailure({ kind: "error", message: "Codex returned an invalid app-server response" }) };
	}
}
