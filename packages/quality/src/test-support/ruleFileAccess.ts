import { rmSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect, Fiber, FileSystem } from "effect";
import { systemError } from "effect/PlatformError";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import type { Findings } from "#rule.ts";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";
import { seedTree } from "./tree.ts";

interface RuleRun {
	fiber: Fiber.Fiber<unknown, unknown> | undefined;
}

interface Checked {
	findings: Findings | undefined;
	outcome: string | undefined;
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
		const checked: Checked = { findings: undefined, outcome: undefined };
		return {
			check: configured.check({ files: [], readText: () => Promise.resolve(undefined), root, sources: [] }),
			checked,
			fs,
			read: fs.readFileString(join(root, "tsconfig.json")),
			root,
			running,
			started: yield* Deferred.make<void>(),
			stopped: yield* Deferred.make<void>(),
		};
	},
	inspect: ({ checked }) => checked,
	layer: services,
	name: "Rule file access",
	stages: ["filesystem", "running"],
	verbs: (engine, story) => ({
		checks: () => {
			story.tell("quality checks TypeScript configuration through the supplied file system");
			const fs = {
				...engine.fs,
				readFileString: (path: string, encoding?: string) =>
					path === join(engine.root, "tsconfig.json") ? engine.read : engine.fs.readFileString(path, encoding),
			};
			return engine.check.pipe(
				Effect.provideService(FileSystem.FileSystem, fs),
				Effect.flatMap((findings) =>
					Effect.sync(() => {
						engine.checked.findings = findings;
						engine.checked.outcome = "checked";
					}),
				),
				Effect.catchIf(
					(failure) => failure instanceof FilesystemFailure,
					(failure) =>
						Effect.sync(() => {
							engine.checked.outcome = `failed: ${failure.message.replaceAll(engine.root, "<root>")}`;
						}),
				),
			);
		},
		findings: () => Effect.sync(() => (engine.checked.findings ?? []).map((finding) => `${finding.file} ${finding.subject}`)),
		interrupts: Effect.fn("RuleFileAccess.interrupts")(function* () {
			story.tell("quality interrupts the rule while its file read is pending");
			if (engine.running.fiber === undefined) {
				return yield* Effect.die(new Error("The rule has not started"));
			}
			yield* Fiber.interrupt(engine.running.fiber);
		}),
		listing: () => Effect.map(Deferred.isDone(engine.stopped), (stopped) => (stopped ? "stopped" : "pending")),
		outcome: () => Effect.sync(() => engine.checked.outcome),
	}),
});

export const suppliedConfig = ruleFileAccess.trait(
	"filesystem",
	"the supplied file system serves a tsconfig.json that sets ignoreDeprecations",
	(engine) => {
		engine.read = Effect.succeed('{ "compilerOptions": { "ignoreDeprecations": "6.0" } }');
	},
);

export const unreadableConfig = ruleFileAccess.trait("filesystem", "the supplied file system refuses to read tsconfig.json", (engine) => {
	engine.read = Effect.fail(
		systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem", pathOrDescriptor: "tsconfig.json" }),
	);
});

export const pendingRead = ruleFileAccess.trait(
	"running",
	"the rule is waiting for the supplied file system to list the repository",
	function* (engine) {
		const fs = {
			...engine.fs,
			readDirectory: () =>
				Effect.andThen(Deferred.succeed(engine.started, undefined), Effect.never).pipe(Effect.ensuring(Deferred.succeed(engine.stopped, undefined))),
		};
		engine.running.fiber = yield* engine.check.pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.forkScoped);
		yield* Deferred.await(engine.started);
	},
);
