import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const command = Effect.fn("ReleaseStory.command")(function* (root: string, args: readonly string[]) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const child = yield* spawner.spawn(
				ChildProcess.make("pnpm", args, {
					cwd: root,
					env: { "CHANGELOG_BASE_REF": "main" },
					extendEnv: true,
				}),
			);
			const [stdout, stderr, status] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{
					concurrency: "unbounded",
				},
			);
			return { status: Number(status), stderr, stdout };
		}),
	);
});
