import process from "node:process";
import { Effect } from "effect";

export function setExitCode(code: number) {
	return Effect.sync(() => {
		process.exitCode = code;
	});
}
