import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Fiber, Option, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export interface DevelopmentServerOptions {
	readonly configFile?: string;
	readonly onOutput?: (source: "stdout" | "stderr", line: string) => void;
}

export const developmentServer = Effect.fn("AppStory.developmentServer")(function* (target: string, options: DevelopmentServerOptions = {}) {
	return yield* Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(
			ChildProcess.make(
				process.execPath,
				["--conditions=source", fileURLToPath(new URL("./developmentServerChild.ts", import.meta.url)), target, options.configFile ?? ""],
				{ additionalFds: { fd3: { type: "output" } } },
			),
		);
		function forward(source: "stdout" | "stderr") {
			return child[source].pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) =>
					Effect.sync(() => options.onOutput?.(source, line)).pipe(Effect.andThen(source === "stdout" ? Console.log(line) : Console.error(line))),
				),
				Effect.forkScoped,
			);
		}
		const output = yield* forward("stdout");
		const errors = yield* forward("stderr");
		// Vite can outlive server.close(); terminate its process before interrupting the output readers.
		yield* Effect.addFinalizer(() =>
			Effect.gen(function* () {
				if (yield* child.isRunning) {
					yield* child.kill();
				}
				yield* Fiber.join(output);
				yield* Fiber.join(errors);
			}).pipe(Effect.orDie),
		);
		const address = yield* child.getOutputFd(3).pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead);
		if (Option.isNone(address)) {
			return yield* Effect.die("Development server exited before listening");
		}
		return { child, url: new URL(address.value).origin };
	}).pipe(Effect.provide(NodeServices.layer));
});
