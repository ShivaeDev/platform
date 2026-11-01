import { fileURLToPath } from "node:url";
import { Deferred, Effect, Exit, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { developmentServer } from "./developmentServer.ts";

type DevelopmentServer = Effect.Success<ReturnType<typeof developmentServer>>;

interface LifecycleEngine {
	readonly blocked: Deferred.Deferred<void>;
	running: { readonly scope: Scope.Closeable; readonly server: DevelopmentServer } | undefined;
	readonly stderr: string[];
	readonly stdout: string[];
}

function running(engine: LifecycleEngine) {
	if (engine.running === undefined) {
		throw new Error("The development server has not started");
	}
	return engine.running;
}

export const developmentLifecycle = storyKit({
	clock: "live",
	*create(): Effect.fn.Return<LifecycleEngine> {
		return { blocked: yield* Deferred.make<void>(), running: undefined, stderr: [], stdout: [] };
	},
	name: "development lifecycle",
	stages: [],
	verbs: (engine, story) => ({
		developmentServerCloses: () => {
			story.tell("the development server's scope closes");
			return Scope.close(running(engine).scope, Exit.void);
		},
		output: (source: "stderr" | "stdout") => Effect.sync(() => [...engine[source]]),
		serverState: Effect.fn("DevelopmentStory.serverState")(function* () {
			return (yield* running(engine).server.child.isRunning) ? "running" : "stopped";
		}),
		startsWithBlockedOptimizer: Effect.fn("DevelopmentStory.startsWithBlockedOptimizer")(function* () {
			story.tell("Vite starts and its dependency optimizer blocks while building");
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const server = yield* developmentServer("http://127.0.0.1:3000", {
				configFile: fileURLToPath(new URL("./blockedOptimizer.config.ts", import.meta.url)),
				onOutput: (source, line) => {
					engine[source].push(line);
					if (line === "dependency optimizer blocked") {
						Effect.runSync(Deferred.succeed(engine.blocked, undefined));
					}
				},
			}).pipe(Scope.provide(scope));
			engine.running = { scope, server };
			yield* Deferred.await(engine.blocked);
		}),
	}),
});
