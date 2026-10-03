import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { Effect } from "effect";

const listening = (server: ChildProcessWithoutNullStreams) =>
	Effect.tryPromise({
		catch: (cause) => new Error("Packed server did not listen", { cause }),
		try: () =>
			new Promise<string>((resolve, reject) => {
				let output = "";
				const timeout = setTimeout(() => reject(new Error(`Server did not listen: ${output}`)), 15_000);
				const done = () => clearTimeout(timeout);
				server.once("error", (error) => {
					done();
					reject(error);
				});
				server.once("exit", (code) => {
					done();
					reject(new Error(`Server exited ${code}: ${output}`));
				});
				server.stderr.on("data", (chunk) => {
					output += String(chunk);
				});
				server.stdout.on("data", (chunk) => {
					output += String(chunk);
					const match = /http:\/\/127\.0\.0\.1:\d+/u.exec(output);
					if (match !== null) {
						done();
						resolve(match[0]);
					}
				});
			}),
	});

export const checkServer = (cwd: string, bin: string, args: readonly string[], pages: Readonly<Record<string, string>>) =>
	Effect.acquireUseRelease(
		Effect.sync(() => {
			const server = spawn(bin, args, { cwd, stdio: "pipe" });
			const exited = new Promise<void>((resolve) => server.once("close", () => resolve()));
			return { exited, server };
		}),
		({ server }) =>
			Effect.gen(function* () {
				const address = yield* listening(server);
				for (const [path, expected] of Object.entries(pages))
					yield* Effect.tryPromise({
						catch: (cause) => new Error(`Packed server request failed: ${path}`, { cause }),
						try: async (signal) => {
							const response = await fetch(`${address}${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
							if (!(response.ok && (await response.text()).includes(expected))) throw new Error(`${bin}: ${path} did not serve ${expected}`);
						},
					});
			}),
		({ server, exited }) =>
			Effect.promise(async () => {
				server.kill("SIGTERM");
				const timeout = setTimeout(() => server.kill("SIGKILL"), 5000);
				await exited;
				clearTimeout(timeout);
			}),
	);
