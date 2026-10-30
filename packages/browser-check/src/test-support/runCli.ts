import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const runCli = Effect.fn("BrowserStory.runCli")(function* (
	root: string,
	url: string,
	args: readonly string[],
	credentials: Readonly<Record<string, string>>,
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL("../cli.ts", import.meta.url)), "--url", url, ...args], {
			cwd: root,
			env: { "BROWSER_CHECK_EMAIL": undefined, "BROWSER_CHECK_PASSWORD": undefined, ...credentials },
			extendEnv: true,
		}),
	);
	const [stdout, stderr, code] = yield* Effect.all(
		[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
		{ concurrency: "unbounded" },
	);
	return { code: Number(code), output: stdout + stderr };
}, Effect.scoped);
