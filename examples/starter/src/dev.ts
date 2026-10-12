import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const program = Effect.gen(function* () {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const options = { stderr: "inherit", stdout: "inherit" } as const;
	const server = ChildProcess.make(process.execPath, ["--conditions=source", "--watch", "src/server/server.ts"], options);
	const vite = ChildProcess.make("pnpm", ["exec", "vite"], options);
	process.exitCode = yield* Effect.raceFirst(spawner.exitCode(server), spawner.exitCode(vite));
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
