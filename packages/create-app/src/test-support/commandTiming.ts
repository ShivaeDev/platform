import { Effect } from "effect";

export function commandTiming(command: string, started: number, stderr: string) {
	Effect.runSync(Effect.log(`[generated app timing] ${command}: ${(performance.now() - started).toFixed(0)} ms`));
	for (const line of stderr.split("\n")) {
		if (line.startsWith("[generated app timing]")) {
			Effect.runSync(Effect.log(line));
		}
	}
}
