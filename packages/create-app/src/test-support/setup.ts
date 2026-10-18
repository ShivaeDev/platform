import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function setup() {
	execFileSync(process.execPath, ["--conditions=source", fileURLToPath(new URL("../pack.ts", import.meta.url))], { stdio: "inherit" });
}
