import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { ConfigProvider, Console, type Context, Deferred, Effect, Fiber, Queue } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { program } from "#cli/program.ts";
import { exitCode, services } from "#cli/runMain.ts";
import { capturing } from "./cli.ts";
import { config, defaultTree, removeSeededTrees } from "./tree.ts";

interface Run {
	biomeStarted: boolean;
	readonly events: Queue.Queue<string>;
	fiber?: Fiber.Fiber<void, unknown>;
	readonly resume: Deferred.Deferred<void>;
}

function observedSpawner(spawner: Context.Service.Shape<typeof ChildProcessSpawner.ChildProcessSpawner>, current: Run) {
	return ChildProcessSpawner.ChildProcessSpawner.of({
		...spawner,
		spawn: (command) =>
			Effect.gen(function* () {
				const child = yield* spawner.spawn(command);
				if (command._tag === "StandardCommand" && command.args.includes("check")) {
					current.biomeStarted = true;
					yield* Queue.offer(current.events, "Biome started");
					yield* Deferred.await(current.resume);
				}
				return child;
			}),
	});
}

export const heavyLint = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const root = realpathSync(defaultTree(config('{ sources: ["src"] }')));
		return { lock: join(root, "heavy.lock"), root, runs: new Map<string, Run>() };
	},
	layer: services,
	name: "Lint's heavy-process lock",
	stages: ["repository"],
	verbs: (engine, story) => {
		function run(name: string): Run {
			const found = engine.runs.get(name);
			if (found === undefined) {
				throw new Error(`Start ${name} before observing it`);
			}
			return found;
		}
		return {
			biomeStarted: (name: string) => Effect.sync(() => run(name).biomeStarted),
			finishes: (name: string) => {
				story.tell(`${name}'s Biome check is allowed to finish`);
				return Deferred.succeed(run(name).resume, undefined);
			},
			interrupts: (name: string) => {
				story.tell(`the author interrupts ${name}`);
				const fiber = run(name).fiber;
				return fiber === undefined ? Effect.die("The lint fiber has not started") : Fiber.interrupt(fiber);
			},
			lockExists: () => Effect.sync(() => existsSync(engine.lock)),
			nextEvent: (name: string) => Queue.take(run(name).events),
			starts: Effect.fn("HeavyLint.starts")(function* (name: string) {
				story.tell(`the author starts ${name} with quality lint`);
				const current: Run = {
					biomeStarted: false,
					events: yield* Queue.unbounded<string>(),
					resume: yield* Deferred.make<void>(),
				};
				engine.runs.set(name, current);
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const output = capturing({ stderr: "", stdout: "" });
				const console = Console.Console.of({
					...output,
					error: (line) => {
						if (String(line).includes("waiting for pid")) {
							Effect.runSync(Queue.offer(current.events, "Waiting for lock"));
						}
					},
				});
				current.fiber = yield* program(["lint"], { cwd: engine.root, launch: { options: [], script: "quality" } }).pipe(
					Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": engine.lock } })),
					Effect.provideService(Console.Console, console),
					Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, observedSpawner(spawner, current)),
					Effect.onExit((exit) => Queue.offer(current.events, `Exited ${exitCode(exit)}`)),
					Effect.forkScoped,
				);
			}),
		};
	},
});
