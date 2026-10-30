import { rmSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect, Fiber, FileSystem } from "effect";
import { systemError } from "effect/PlatformError";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";
import { seedTree } from "./tree.ts";

interface RuleRun {
	fiber: Fiber.Fiber<unknown, unknown> | undefined;
}

export const ruleFileAccess = storyKit({
	*create() {
		const root = seedTree([{ content: '{ "compilerOptions": { "strict": true } }', path: "tsconfig.json" }]);
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const fs = yield* FileSystem.FileSystem;
		const configured = yield* Effect.promise(() => noIgnoreDeprecations.configure(undefined));
		if (configured._tag !== "Ready") {
			return yield* Effect.die(new Error(configured.issues.join("; ")));
		}
		const running: RuleRun = { fiber: undefined };
		return {
			check: configured.check({ files: [], readText: () => Promise.resolve(undefined), root, sources: [] }),
			fs,
			read: fs.readFileString(join(root, "tsconfig.json")),
			root,
			running,
			started: yield* Deferred.make<void>(),
			stopped: yield* Deferred.make<void>(),
		};
	},
	layer: services,
	name: "Rule file access",
	stages: ["filesystem", "running"],
	verbs: (engine, story) => {
		function check() {
			story.tell("the author checks TypeScript configuration through the supplied file system");
			return engine.check.pipe(
				Effect.provideService(FileSystem.FileSystem, {
					...engine.fs,
					readFileString: (path, encoding) => (path === join(engine.root, "tsconfig.json") ? engine.read : engine.fs.readFileString(path, encoding)),
				}),
			);
		}
		return {
			check,
			checkFailure: () =>
				check().pipe(
					Effect.flip,
					Effect.flatMap((failure) =>
						failure instanceof FilesystemFailure ? Effect.succeed({ message: failure.message, path: failure.path }) : Effect.die(failure),
					),
				),
			interrupt: () =>
				Effect.gen(function* () {
					story.tell("the author interrupts the rule while its file read is pending");
					if (engine.running.fiber === undefined) {
						return yield* Effect.die(new Error("The rule has not started"));
					}
					yield* Fiber.interrupt(engine.running.fiber);
					return yield* Deferred.isDone(engine.stopped);
				}),
		};
	},
});

export const suppliedConfig = ruleFileAccess.trait("filesystem", "the supplied file system has a deprecated configuration", (engine) => {
	engine.read = Effect.succeed('{ "compilerOptions": { "ignoreDeprecations": "6.0" } }');
});

export const unreadableConfig = ruleFileAccess.trait("filesystem", "the supplied file system refuses a configuration read", (engine) => {
	engine.read = Effect.fail(
		systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem", pathOrDescriptor: "tsconfig.json" }),
	);
});

export const pendingRead = ruleFileAccess.trait("running", "a rule is waiting for its file system", function* (engine) {
	const fs = {
		...engine.fs,
		readDirectory: () =>
			Effect.andThen(Deferred.succeed(engine.started, undefined), Effect.never).pipe(Effect.ensuring(Deferred.succeed(engine.stopped, undefined))),
	};
	engine.running.fiber = yield* engine.check.pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.forkScoped);
	yield* Deferred.await(engine.started);
});
