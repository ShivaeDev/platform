import { spawnSync } from "node:child_process";
import process from "node:process";
import { Config, Effect } from "effect";

export function environmentGate(requirement: string, command: string, args: readonly string[]) {
	const result = spawnSync(command, args, { encoding: "utf8", timeout: 10_000 });
	if (result.status === 0) {
		return true;
	}
	const message = `${requirement} is required: ${result.error?.message ?? result.stderr.trim()}`;
	if (Effect.runSync(Config.String("CI").pipe(Config.withDefault("")))) {
		throw new Error(message);
	}
	process.stderr.write(`Skipping real local-postgres stories: ${message}\n`);
	return false;
}
