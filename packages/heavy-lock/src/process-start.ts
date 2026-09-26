import { Effect, Option, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { Holder } from "./holder.ts";

// `ps` prints the start time in the locale's format, so every implementation reads it in the C locale to compare it byte for byte.
const psStartTime = (pid: number) =>
	ChildProcess.make("ps", ["-o", "lstart=", "-p", String(pid)], {
		env: { LC_ALL: "C" },
		extendEnv: true,
		stdin: "ignore",
		stderr: "ignore",
	});

export const processStartTime = (pid: number) =>
	Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const ps = yield* spawner.spawn(psStartTime(pid));
			const [printed, exitCode] = yield* Effect.all([Stream.mkString(Stream.decodeText(ps.stdout)), ps.exitCode], { concurrency: "unbounded" });
			const started = printed.trim();
			return exitCode === 0 && started !== "" ? Option.some(started) : Option.none<string>();
		}),
	);

// A holder killed outright leaves its lock behind, and the OS may hand its pid to a new process.
export const isHolderAlive = (holder: Holder) =>
	Effect.map(processStartTime(holder.pid), (started) => Option.contains(started, holder.processStartedAt));
