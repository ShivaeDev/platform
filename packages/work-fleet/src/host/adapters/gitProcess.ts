import { execFile } from "node:child_process";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

interface GitOptions {
	readonly acceptExitOne?: boolean;
	readonly failureMessage?: (message: string) => string;
	readonly maxBuffer?: number;
}

export function gitProcess(cwd: string, args: readonly string[], options: GitOptions = {}) {
	return Effect.callback<{ readonly stdout: string; readonly exitCode: number }, ServiceUnavailable>((resume) => {
		const child = execFile(
			"git",
			[...args],
			{ cwd, ...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }), timeout: 60_000 },
			(error, stdout) => {
				resume(
					error === null || (options.acceptExitOne && error.code === 1)
						? Effect.succeed({ exitCode: error === null ? 0 : 1, stdout })
						: Effect.fail(new ServiceUnavailable({ message: options.failureMessage?.(error.message) ?? `git ${args[0]} failed: ${error.message}` })),
				);
			},
		);
		const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
		return Effect.promise(async () => {
			child.kill();
			await closed;
		});
	});
}
