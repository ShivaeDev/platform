import { createHash } from "node:crypto";
import { Effect } from "effect";

export function sha256Hex(parts: ReadonlyArray<string | Uint8Array>) {
	return Effect.sync(() => {
		const hash = createHash("sha256");
		for (const part of parts) {
			hash.update(part);
		}
		return hash.digest("hex");
	});
}
