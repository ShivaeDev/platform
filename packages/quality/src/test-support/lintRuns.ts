import { createRequire } from "node:module";
import { dirname } from "node:path";
import { Effect, FileSystem, Path, Tracer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { type Run, runQualityWith } from "#testing/adapters/cli.ts";
import { packageRoot, type SeedFile } from "#testing/adapters/tree.ts";

interface LintRunEngine {
	answer: Run | undefined;
	environment: Readonly<Record<string, string>>;
	readonly root: string;
	readonly spans: string[];
}

function answered(engine: LintRunEngine): Effect.Effect<Run> {
	return engine.answer === undefined ? Effect.die(new Error("Run quality lint before reading its answer")) : Effect.succeed(engine.answer);
}

function outcomeOf({ status }: Run): string {
	if (status === 0) {
		return "passed";
	}
	return status === 1 ? "rejected" : `exited ${String(status)}`;
}

const writeAll = Effect.fn("LintRuns.writeAll")(function* (root: string, files: readonly SeedFile[]) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (const file of files) {
		const target = path.join(root, file.path);
		yield* fs.makeDirectory(path.dirname(target), { recursive: true });
		yield* fs.writeFileString(target, file.content);
	}
});

const linkAll = Effect.fn("LintRuns.linkAll")(function* (root: string, links: Readonly<Record<string, string>>) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (const [link, target] of Object.entries(links)) {
		yield* fs.makeDirectory(path.dirname(path.join(root, link)), { recursive: true });
		yield* fs.symlink(target, path.join(root, link));
	}
});

export const lintRunStory = storyKit({
	create: () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const engine: LintRunEngine = {
				answer: undefined,
				environment: {},
				root: yield* fs.makeTempDirectoryScoped({ prefix: "quality-lint-run-" }),
				spans: [],
			};
			return engine;
		}),
	inspect: ({ answer, environment }) => ({ answer, environment }),
	layer: services,
	name: "Quality lint run",
	stages: ["repository", "environment"],
	verbs: (engine, story) => ({
		lastLine: () => Effect.map(answered(engine), (answer) => answer.stdout.trimEnd().split("\n").at(-1)),
		lints: Effect.fn("LintRuns.lints")(function* (...args: readonly string[]) {
			story.tell(["quality lint", ...args].join(" "));
			engine.spans.length = 0;
			const tracer = Tracer.make({
				span: (options) => {
					engine.spans.push(options.name);
					return new Tracer.NativeSpan(options);
				},
			});
			engine.answer = yield* runQualityWith(engine.root, engine.environment, "lint", ...args).pipe(Effect.provideService(Tracer.Tracer, tracer));
		}),
		outcome: () => Effect.map(answered(engine), outcomeOf),
		reads: Effect.fn("LintRuns.reads")(function* (path: string) {
			const fs = yield* FileSystem.FileSystem;
			const paths = yield* Path.Path;
			return yield* fs.readFileString(paths.join(engine.root, path));
		}),
		report: () => Effect.map(answered(engine), (answer) => answer.stdout + answer.stderr),
		reportsRule: (rule: string) =>
			Effect.map(answered(engine), (answer) => answer.stdout.split("\n\n").some((section) => section.startsWith(`error ${rule} (`))),
		spanCount: (name: string) => Effect.sync(() => engine.spans.filter((span) => span === name).length),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return lintRunStory.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) =>
		writeAll(engine.root, files),
	);
}

export function effectInstalled() {
	return lintRunStory.trait("repository", "Quality and effect are installed in node_modules", (engine) =>
		linkAll(engine.root, {
			"node_modules/@shivaedev/quality": packageRoot,
			"node_modules/effect": dirname(createRequire(import.meta.url).resolve("effect/package.json")),
		}),
	);
}

export function debtRecorded() {
	return lintRunStory.trait("repository", "quality baseline write has recorded every finding of every rule as debt", (engine) =>
		Effect.flatMap(runQualityWith(engine.root, {}, "baseline", "write"), (run) =>
			run.status === 0 ? Effect.void : Effect.die(new Error(`quality baseline write failed:\n${run.stdout}${run.stderr}`)),
		),
	);
}

export function environmentSets(environment: Readonly<Record<string, string>>) {
	return lintRunStory.trait("environment", `the environment sets ${JSON.stringify(environment)}`, (engine) => {
		engine.environment = environment;
	});
}
