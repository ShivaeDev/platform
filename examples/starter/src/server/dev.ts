import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const program = Effect.gen(function* () {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const options = { stderr: "inherit", stdout: "inherit" } as const;
	const server = ChildProcess.make(process.execPath, ["--conditions=source", "--watch", "src/server/server.ts"], options);
	const vite = ChildProcess.make("pnpm", ["exec", "vite"], options);
	const worker = ChildProcess.make(process.execPath, ["--conditions=source", "--watch", "src/server/worker.ts"], options);
	process.exitCode = yield* Effect.raceAll([spawner.exitCode(server), spawner.exitCode(worker), spawner.exitCode(vite)]);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
