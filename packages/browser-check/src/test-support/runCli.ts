import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { SignIn } from "./startHost.ts";

export interface CliRun {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

export const runCli = Effect.fn("BrowserStory.runCli")(function* (
	root: string,
	url: string,
	args: readonly string[],
	credentials: SignIn | undefined,
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), "--url", url, ...args], {
			cwd: root,
			env: { "BROWSER_CHECK_EMAIL": credentials?.email, "BROWSER_CHECK_PASSWORD": credentials?.password },
			extendEnv: true,
		}),
	);
	const [stdout, stderr, code] = yield* Effect.all(
		[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
		{ concurrency: "unbounded" },
	);
	const run: CliRun = { code: Number(code), stderr, stdout };
	return run;
}, Effect.scoped);
