import { spawn } from "node:child_process";
import process from "node:process";
import { Config, Effect } from "effect";

const LIMIT = /^--max[-_]old[-_]space[-_]size(?:=|$)/u;
const FORWARDED = ["SIGHUP", "SIGINT", "SIGTERM"] as const;
const COULD_NOT_RUN = 2;

function callerLimited(): boolean {
	const environment = Effect.runSync(Config.String("NODE_OPTIONS").pipe(Config.withDefault("")));
	return [...process.execArgv, ...environment.split(/\s+/u)].some((option) => LIMIT.test(option));
}

export function withoutHeapLimit(options: readonly string[]): readonly string[] {
	return options.filter((option) => !LIMIT.test(option));
}

// Node fixes its heap limit at startup, so the process starts itself again under the limit and stays to forward signals and explain an abort. A limit the caller set through Node is kept as it is. The program loads only in the process that runs it.
export function runWithHeapLimit<TError>(
	limit: Effect.Effect<number, TError>,
	reached: (megabytes: number) => string,
	load: () => Promise<{ readonly main: () => void }>,
): void {
	if (callerLimited()) {
		void load().then(({ main }) => main());
		return;
	}
	const megabytes = Effect.runSync(limit);
	const child = spawn(process.execPath, [...process.execArgv, `--max-old-space-size=${megabytes}`, ...process.argv.slice(1)], { stdio: "inherit" });
	function forward(signal: NodeJS.Signals): void {
		child.kill(signal);
	}
	for (const signal of FORWARDED) {
		process.on(signal, forward);
	}
	function settle(): void {
		for (const signal of FORWARDED) {
			process.off(signal, forward);
		}
	}
	child.on("error", (error) => {
		settle();
		process.stderr.write(`quality: could not start under its heap limit: ${error.message}\n`);
		process.exitCode = COULD_NOT_RUN;
	});
	child.on("exit", (code, signal) => {
		settle();
		if (signal === "SIGABRT") {
			process.stderr.write(`${reached(megabytes)}\n`);
			process.exitCode = COULD_NOT_RUN;
			return;
		}
		if (signal !== null) {
			process.kill(process.pid, signal);
			return;
		}
		process.exitCode = code ?? COULD_NOT_RUN;
	});
}
