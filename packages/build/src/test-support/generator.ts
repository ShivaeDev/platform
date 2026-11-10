import { pathToFileURL } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ConfigProvider, Effect, Exit, Fiber, FileSystem, Option, Path, Predicate, Schema, Scope } from "effect";
import { TestClock } from "effect/testing";
import { acquireHeavyLock } from "@shivaedev/heavy-lock/acquire.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { generate } from "#generate.ts";
import type { GenerateFailed, GenerateReport } from "#report.ts";
import { emptyProject, fromSource, typeCheck, writeFiles } from "#test/fixtureProject.ts";
import { NOTES_PROJECT } from "#test/notesProject.ts";
import { REFUSING_PROJECT } from "#test/refusingProject.ts";

const NOTES_WIRE = "src/generated/modules/notes/notes.ts";
const NOTES_MODEL = "src/modules/notes/model.ts";

type WireSchema = Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

// A generated schema's services are Effect's own codecs, which need none.
function isWireSchema(value: unknown): value is WireSchema {
	return Schema.isSchema(value);
}

interface GenerateOutcome {
	readonly files: Readonly<Record<string, string>>;
	readonly problems: readonly string[];
	readonly programBuilt: boolean;
	readonly result: "failed" | "succeeded";
}

interface GeneratorEngine {
	readonly lock: string;
	otherHold: Option.Option<Scope.Closeable>;
	readonly root: string;
	running: Option.Option<Fiber.Fiber<GenerateOutcome, unknown>>;
}

function outcomeOf(report: GenerateReport, failed: GenerateFailed | undefined): GenerateOutcome {
	return {
		files: Object.fromEntries(report.modules.map(({ output, status }) => [output, status])),
		problems: failed?.problems ?? [],
		programBuilt: report.programBuilt,
		result: failed === undefined ? "succeeded" : "failed",
	};
}

// Only the story's lock file, so the lock is taken even on CI, where a set CI variable skips it.
function onlyTheStoryLock(engine: GeneratorEngine) {
	return Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": engine.lock } }));
}

const importedFrom = Effect.fn("BuildStory.importedFrom")(function* (engine: GeneratorEngine, file: string) {
	const path = yield* Path.Path;
	const imported: unknown = yield* Effect.promise(() => import(pathToFileURL(path.join(engine.root, file)).href));
	return imported;
});

const notesSuccess = Effect.fn("BuildStory.notesSuccess")(function* (engine: GeneratorEngine, operation: string) {
	const generated = yield* importedFrom(engine, NOTES_WIRE);
	const wire = Predicate.hasProperty(generated, "notesWire") ? generated.notesWire : undefined;
	const entry = Predicate.hasProperty(wire, operation) ? wire[operation] : undefined;
	const success = Predicate.hasProperty(entry, "success") ? entry.success : undefined;
	return isWireSchema(success) ? success : yield* Effect.die(new Error(`the generated notes wire has no success schema for ${operation}`));
});

function run(engine: GeneratorEngine, check: boolean) {
	return generate(engine.root, { check }).pipe(
		Effect.map((report) => outcomeOf(report, undefined)),
		Effect.catchTag("GenerateFailed", (failed) => Effect.succeed(outcomeOf(failed.report, failed))),
		onlyTheStoryLock(engine),
	);
}

export const generator = storyKit({
	*create() {
		const root = yield* emptyProject();
		const path = yield* Path.Path;
		const engine: GeneratorEngine = { lock: path.join(root, "heavy-process.lock"), otherHold: Option.none(), root, running: Option.none() };
		return engine;
	},
	inspect: ({ root }) => ({ root }),
	layer: NodeServices.layer,
	name: "generator",
	stages: ["project", "generated", "lock"],
	verbs: (engine, story) => ({
		compiles: () => {
			story.tell("tsc type-checks the project");
			return typeCheck(engine.root, engine.lock);
		},
		edits: Effect.fn("BuildStory.edits")(function* (file: string, from: string, to: string) {
			story.tell(`the application changes ${from} to ${to} in ${file}`);
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const text = yield* fs.readFileString(path.join(engine.root, file));
			if (!text.includes(from)) {
				return yield* Effect.die(new Error(`${file} does not contain ${from}`));
			}
			yield* fs.writeFileString(path.join(engine.root, file), text.replace(from, to));
		}),
		generatedFile: Effect.fn("BuildStory.generatedFile")(function* (file: string) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const full = path.join(engine.root, file);
			return (yield* fs.exists(full)) ? yield* fs.readFileString(full) : "missing";
		}),
		generates: () => {
			story.tell("the application runs generate");
			return run(engine, false);
		},
		generatesWithCheck: () => {
			story.tell("the application runs generate --check");
			return run(engine, true);
		},
		heavyLockPollPasses: Effect.fn("BuildStory.heavyLockPollPasses")(function* () {
			story.tell("a second passes and the waiting generate tries the heavy lock again");
			yield* TestClock.adjust("1 second");
			return Option.isSome(engine.running) ? yield* Fiber.join(engine.running.value) : yield* Effect.die(new Error("no generate is running"));
		}),
		noteCard: Effect.fn("BuildStory.noteCard")(function* (id: number, title: string) {
			const model = yield* importedFrom(engine, NOTES_MODEL);
			const NoteCard = Predicate.hasProperty(model, "NoteCard") ? model.NoteCard : undefined;
			if (!Predicate.isFunction(NoteCard)) {
				return yield* Effect.die(new Error(`${NOTES_MODEL} exports no NoteCard class`));
			}
			const card: unknown = Reflect.construct(NoteCard, [{ id, title }]);
			return card;
		}),
		otherRunReleasesTheHeavyLock: Effect.fn("BuildStory.otherRunReleasesTheHeavyLock")(function* () {
			story.tell("the other heavy run releases the lock");
			if (Option.isSome(engine.otherHold)) {
				yield* Scope.close(engine.otherHold.value, Exit.void);
			}
		}),
		receives: Effect.fn("BuildStory.receives")(function* (operation: string, sent: unknown) {
			story.tell(`the server encodes what ${operation} returns with the generated wire, JSON carries it and the browser decodes it`);
			const codec = Schema.toCodecJson(yield* notesSuccess(engine, operation));
			const encoded = yield* Schema.encodeUnknownEffect(codec)(sent).pipe(Effect.option);
			if (Option.isNone(encoded)) {
				return "cannot be encoded";
			}
			const received: unknown = yield* Schema.decodeUnknownEffect(codec)(JSON.parse(JSON.stringify(encoded.value)));
			return received;
		}),
		removesTheCache: Effect.fn("BuildStory.removesTheCache")(function* () {
			story.tell("the application removes node_modules/.cache");
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* fs.remove(path.join(engine.root, "node_modules", ".cache"), { recursive: true });
		}),
		removesTheGeneratedFile: Effect.fn("BuildStory.removesTheGeneratedFile")(function* (file: string) {
			story.tell(`the application removes ${file}`);
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* fs.remove(path.join(engine.root, file));
		}),
		renames: Effect.fn("BuildStory.renames")(function* (from: string, to: string) {
			story.tell(`the application renames ${from} to ${to}`);
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* fs.rename(path.join(engine.root, from), path.join(engine.root, to));
		}),
		runsFromSource: (...args: readonly string[]) => {
			story.tell(`the application runs node --conditions=@shivaedev/source src/cli.ts ${args.join(" ")}`);
			return fromSource(engine.root, engine.lock, args);
		},
		startsGenerating: Effect.fn("BuildStory.startsGenerating")(function* () {
			story.tell("the application starts generate");
			engine.running = Option.some(yield* Effect.forkScoped(run(engine, false)));
		}),
		waitsForTheHeavyLock: () => {
			story.tell("generate waits a second to try the heavy lock again");
			return untilTimer("1 second");
		},
	}),
});

export function notesProject() {
	return generator.trait("project", "the project has the notes module", (engine) => writeFiles(engine.root, NOTES_PROJECT));
}

export function refusingProject() {
	return generator.trait("project", "the project has the refused module, whose operations the wire cannot carry exactly", (engine) =>
		writeFiles(engine.root, REFUSING_PROJECT),
	);
}

export function ownFileInGenerated(file: string, text: string) {
	return generator.trait("project", `the application keeps its own ${file}, which generate did not write`, (engine) =>
		writeFiles(engine.root, { [file]: text }),
	);
}

export function generatedFileAt(file: string, source: string) {
	return generator.trait("project", `${file} holds a file generate wrote from ${source}`, (engine) =>
		writeFiles(engine.root, {
			[file]: `// Generated by @shivaedev/build from ${source}. Do not edit or commit this file; run \`pnpm generate\` to write it again.\nexport {};\n`,
		}),
	);
}

export function generatedOnce() {
	return generator.trait("generated", "generate has written the project's files", (engine) => Effect.asVoid(run(engine, false)));
}

export function heavyLockHeldElsewhere() {
	return generator.trait("lock", "another heavy run holds the heavy lock", function* (engine) {
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
		yield* acquireHeavyLock({ command: "another heavy run", lockPath: engine.lock }).pipe(
			Effect.provideService(Scope.Scope, scope),
			onlyTheStoryLock(engine),
		);
		engine.otherHold = Option.some(scope);
	});
}
