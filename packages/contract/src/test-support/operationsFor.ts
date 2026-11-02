import { Schema } from "effect";
import { command, query, stream } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";

export function operationsFor(kind: "query" | "command" | "stream", name: string) {
	if (kind === "query") {
		return { queries: [query(name, { readPolicy: signedIn, reads: () => [] })] };
	}
	if (kind === "command") {
		return { commands: [command(name, { invalidates: () => [] })] };
	}
	return { streams: [stream(name, { reads: () => [], success: Schema.String })] };
}
