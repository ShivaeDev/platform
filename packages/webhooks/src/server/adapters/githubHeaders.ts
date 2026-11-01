import { createHmac } from "node:crypto";
import { Effect, Redacted } from "effect";

export function githubHeaders(body: string, key: Redacted.Redacted<string>) {
	return Effect.sync(() => ({ "x-hub-signature-256": `sha256=${createHmac("sha256", Redacted.value(key)).update(body).digest("hex")}` }));
}
