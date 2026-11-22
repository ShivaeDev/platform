import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, Exit, Fiber, FileSystem, Option, Path, Predicate, Schema, Scope } from "effect";
import { TestClock } from "effect/testing";
import { schemaFieldKeys } from "@shivaedev/errors/schemaFieldScope.ts";
import { acquireHeavyLock } from "@shivaedev/heavy-lock/acquire.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { CATALOG_PROJECT } from "#test/catalogProject.ts";
import { type ClientModuleShape, clientModuleFile, clientModulePath } from "#test/clientModulesProject.ts";
import { CREDENTIAL_MODEL } from "#test/credentialModel.ts";
import { emptyProject, fromSource, generatedOncePerFile, projectIn, typeCheck, writeFiles } from "#test/fixtureProject.ts";
import { importedFrom, successSchema } from "#test/generatedWire.ts";
import { type GenerateOutcome, generateIn, onlyTheStoryLock } from "#test/generateRun.ts";
import { type HeldRun, type HoldPoint, startedHeld } from "#test/heldRuns.ts";
import { MISPLACED_MODULES } from "#test/misplacedModules.ts";
import { NOTES_PROJECT } from "#test/notesProject.ts";
import { PUBLIC_SHAPE_PROJECT } from "#test/publicShapeProject.ts";
import { REFUSED_BRANDS } from "#test/refusedBrands.ts";
import { REFUSING_PROJECT } from "#test/refusingProject.ts";
import { type PartsMark, partsOnlyOf, REGISTRATIONS_PROJECT, type RegistrationShape, registrationOf } from "#test/registrationsProject.ts";
import { SERVER_ONLY_PROJECT } from "#test/serverOnlyProject.ts";

const NOTES_MODEL = "src/modules/notes/model.ts";

interface GeneratorEngine {
	readonly held: Map<string, HeldRun<GenerateOutcome>>;
	readonly lock: string;
	otherHold: Option.Option<Scope.Closeable>;
	root: string;
	running: Option.Option<Fiber.Fiber<GenerateOutcome, unknown>>;
}

function run(engine: GeneratorEngine, check: boolean) {
	return generateIn(engine.root, engine.lock, check);
}

export const generator = storyKit({
	*create() {
		const root = yield* emptyProject();
		const path = yield* Path.Path;
		const engine: GeneratorEngine = {
			held: new Map(),
			lock: path.join(root, "heavy-process.lock"),
			otherHold: Option.none(),
			root,
			running: Option.none(),
		};
		return engine;
	},
	inspect: ({ root }) => ({ root }),
	layer: NodeServices.layer,
	name: "generator",
	stages: ["project", "generated", "lock"],
	verbs: (engine, story) => ({
		addsClientModule: Effect.fn("BuildStory.addsClientModule")(function* (module: string, shape: ClientModuleShape = "built by clientModule") {
			const file = clientModulePath(module, shape);
			story.tell(`the developer writes ${file}, exporting the ${module} client module ${shape}`);
			yield* writeFiles(engine.root, { [file]: clientModuleFile(module, shape) });
		}),
		addsPartsOnly: Effect.fn("BuildStory.addsPartsOnly")(function* (file: string, name: string, parts: readonly string[], mark: PartsMark) {
			story.tell(`the developer writes ${file}, exporting ${name} with only ${parts.join(" and ")}, written with ${mark}`);
			yield* writeFiles(engine.root, { [file]: partsOnlyOf(name, parts, mark) });
		}),
		addsRegistration: Effect.fn("BuildStory.addsRegistration")(function* (module: string, shape: RegistrationShape = "written satisfies AppModule") {
			const file = `src/modules/${module.toLowerCase()}/server/registration.ts`;
			story.tell(`the developer writes ${file}, exporting the ${module} registration ${shape}`);
			yield* writeFiles(engine.root, { [file]: registrationOf(`${module.toLowerCase()}Registration`, module, shape) });
		}),
		addsRegistrationAt: Effect.fn("BuildStory.addsRegistrationAt")(function* (file: string, module: string, shape: RegistrationShape) {
			story.tell(`the developer writes ${file}, exporting the ${module} registration ${shape}`);
			yield* writeFiles(engine.root, { [file]: registrationOf(`${module.toLowerCase()}Registration`, module, shape) });
		}),
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
		entriesOf: Effect.fn("BuildStory.entriesOf")(function* (folder: string) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return (yield* fs.readDirectory(path.join(engine.root, folder))).toSorted();
		}),
		everythingUnder: Effect.fn("BuildStory.everythingUnder")(function* (folder: string) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return (yield* fs.readDirectory(path.join(engine.root, folder), { recursive: true })).toSorted();
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
		generatesUntilFileSystemError: Effect.fn("BuildStory.generatesUntilFileSystemError")(function* () {
			story.tell("the application runs generate");
			return yield* run(engine, false).pipe(
				Effect.as("no file system error"),
				Effect.catchTag("PlatformError", (error) => Effect.succeed(error.message.replaceAll(`${engine.root}/`, ""))),
			);
		}),
		generatesWithCheck: () => {
			story.tell("the application runs generate --check");
			return run(engine, true);
		},
		heavyLockPollPasses: Effect.fn("BuildStory.heavyLockPollPasses")(function* () {
			story.tell("a second passes and the waiting generate tries the heavy lock again");
			yield* TestClock.adjust("1 second");
			return Option.isSome(engine.running) ? yield* Fiber.join(engine.running.value) : yield* Effect.die(new Error("no generate is running"));
		}),
		heldGenerateContinues: Effect.fn("BuildStory.heldGenerateContinues")(function* (name: string) {
			story.tell(`${name} continues`);
			const held = engine.held.get(name);
			if (held === undefined) {
				return yield* Effect.die(new Error(`${name} is not held`));
			}
			yield* Deferred.succeed(held.release, undefined);
			return yield* Fiber.join(held.fiber);
		}),
		marksOf: Effect.fn("BuildStory.marksOf")(function* (module: string, operation: string) {
			return [...schemaFieldKeys((yield* successSchema(engine.root, module, operation)).ast, [])].toSorted((left, right) =>
				left.localeCompare(right),
			);
		}),
		noteCard: Effect.fn("BuildStory.noteCard")(function* (id: number, title: string) {
			const model = yield* importedFrom(engine.root, NOTES_MODEL);
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
		receives: Effect.fn("BuildStory.receives")(function* (operation: string, sent: unknown, module = "notes") {
			story.tell(`the server encodes what ${module}.${operation} returns with the generated wire, JSON carries it and the browser decodes it`);
			const codec = Schema.toCodecJson(yield* successSchema(engine.root, module, operation));
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
		startsGeneratingHeld: Effect.fn("BuildStory.startsGeneratingHeld")(function* (name: string, point: HoldPoint) {
			story.tell(`${name} starts and is held before ${point.before} ${point.file}`);
			engine.held.set(name, yield* startedHeld(name, engine.root, point, run(engine, false)));
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

export function catalogProject() {
	return generator.trait("project", "the project has the catalog module, whose ids are branded and whose items carry authored JSON", (engine) =>
		writeFiles(engine.root, CATALOG_PROJECT),
	);
}

export function projectInsideModulesFolder() {
	return generator.trait("project", "the project's checkout sits in a folder named modules", function* (engine) {
		const path = yield* Path.Path;
		engine.root = yield* projectIn(path.join(engine.root, "modules", "my-app"));
	});
}

export function registrationsProject() {
	return generator.trait(
		"project",
		"the project registers its tags, notes and archive modules and a notes kit registers a fake of its own",
		(engine) => writeFiles(engine.root, REGISTRATIONS_PROJECT),
	);
}

export function importsTheServerList() {
	return generator.trait("project", "the project's src/server/modules.ts imports the generated server module list", (engine) =>
		writeFiles(engine.root, { "src/server/modules.ts": REGISTRATIONS_PROJECT["src/server/modules.ts"] ?? "" }),
	);
}

export function refusingProject() {
	return generator.trait("project", "the project has the refused module, whose operations the wire cannot carry exactly", (engine) =>
		writeFiles(engine.root, { ...MISPLACED_MODULES, ...REFUSED_BRANDS, ...REFUSING_PROJECT }),
	);
}

export function serverOnlyProject() {
	return generator.trait(
		"project",
		"the project has the accounts module, whose operations return a stored credential or its server-only digest",
		(engine) => writeFiles(engine.root, { ...SERVER_ONLY_PROJECT, "src/modules/accounts/model.ts": CREDENTIAL_MODEL }),
	);
}

export function publicShapeProject() {
	return generator.trait(
		"project",
		"the project has the credentials module, whose holder query returns a stored credential's public fields and whose sign-in payload carries a password",
		(engine) => writeFiles(engine.root, { ...PUBLIC_SHAPE_PROJECT, "src/modules/credentials/model.ts": CREDENTIAL_MODEL }),
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

export function linkToItselfAt(file: string) {
	return generator.trait("project", `${file} is a link to itself, which no file system call can follow`, function* (engine) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.makeDirectory(path.dirname(path.join(engine.root, file)), { recursive: true });
		yield* fs.symlink(path.join(engine.root, file), path.join(engine.root, file));
	});
}

export function generatedOnce() {
	return generator.trait("generated", "generate has written the project's files", (engine) => generatedOncePerFile(engine.root, run(engine, false)));
}

export function heavyLockHeldElsewhere() {
	return generator.trait("lock", "another heavy run holds the heavy lock", function* (engine) {
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
		yield* acquireHeavyLock({ command: "another heavy run", lockPath: engine.lock }).pipe(
			Effect.provideService(Scope.Scope, scope),
			onlyTheStoryLock(engine.lock),
		);
		engine.otherHold = Option.some(scope);
	});
}
