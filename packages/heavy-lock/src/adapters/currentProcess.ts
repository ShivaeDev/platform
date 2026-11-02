import process from "node:process";
import { Effect } from "effect";

export const currentProcess = Effect.sync(() => ({
	command: process.argv.slice(1).join(" "),
	cwd: process.cwd(),
	pid: process.pid,
}));
