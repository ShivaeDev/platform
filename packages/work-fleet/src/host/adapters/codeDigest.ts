import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";

export function codeDigest(file: string) {
	return createHash("sha256").update(realpathSync(file)).update(readFileSync(file)).digest("hex");
}
