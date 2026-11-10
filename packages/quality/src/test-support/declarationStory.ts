import { Effect, FileSystem, Path } from "effect";
import ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { services } from "#adapters/runMain.ts";
import { sourcesProgram } from "#adapters/typeScriptProgram.ts";
import { linesOf } from "#inventory/linesOf.ts";

interface DeclarationEngine {
	readonly programs: Map<string, ts.Program>;
	readonly root: string;
}

const LABELS = "node_modules/fixture-labels/index.d.ts";

function labels(edition: string): string {
	return `export interface Labelled<T> { readonly label: T }\nexport declare const edition: ${JSON.stringify(edition)};\n`;
}

const write = Effect.fn("DeclarationStory.write")(function* (engine: DeclarationEngine, path: string, content: string) {
	const fs = yield* FileSystem.FileSystem;
	const paths = yield* Path.Path;
	const target = paths.join(engine.root, path);
	yield* fs.makeDirectory(paths.dirname(target), { recursive: true });
	yield* fs.writeFileString(target, content);
});

function programOf(engine: DeclarationEngine, name: string): Effect.Effect<ts.Program> {
	const program = engine.programs.get(name);
	return program === undefined ? Effect.die(new Error(`Compile ${name} before reading it`)) : Effect.succeed(program);
}

export const declarationStory = storyKit({
	create: () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "quality-declarations-" }));
			const engine: DeclarationEngine = { programs: new Map(), root };
			return engine;
		}),
	inspect: ({ programs, root }) => ({ programs: [...programs.keys()], root }),
	layer: services,
	name: "Quality declaration files",
	stages: ["repository"],
	verbs: (engine, story) => ({
		compile: Effect.fn("DeclarationStory.compile")(function* (name: string, text: string) {
			story.tell(`a rule compiles ${name} with src/main.ts: ${text}`);
			engine.programs.set(name, (yield* sourcesProgram(engine.root, [{ lines: linesOf(text), path: "src/main.ts", text }])).program);
		}),
		compileTargeting: Effect.fn("DeclarationStory.compileTargeting")(function* (name: string, target: ts.ScriptTarget) {
			story.tell(`a program targeting ${ts.ScriptTarget[target]} reads ${LABELS} as ${name}`);
			const options: ts.CompilerOptions = { noLib: true, target, types: [] };
			const host = ts.createCompilerHost(options);
			const declarations = yield* DeclarationFiles;
			host.getSourceFile = yield* declarations.reader(host, options);
			engine.programs.set(name, ts.createProgram([`${engine.root}/${LABELS}`], options, host));
		}),
		labelsUpdated: (edition: string) => {
			story.tell(`fixture-labels is updated so its edition is "${edition}"`);
			return write(engine, LABELS, labels(edition));
		},
		parsing: Effect.fn("DeclarationStory.parsing")(function* (path: string) {
			const programs = yield* Effect.forEach(engine.programs.keys(), (name) => programOf(engine, name));
			const files = programs.map((program) => program.getSourceFile(`${engine.root}/${path}`));
			if (files.includes(undefined)) {
				return yield* Effect.die(new Error(`Every compiled program should hold ${path}`));
			}
			return new Set(files).size === 1 ? "shared" : "parsed per program";
		}),
		valueType: Effect.fn("DeclarationStory.valueType")(function* (name: string) {
			const program = yield* programOf(engine, name);
			const checker = program.getTypeChecker();
			const source = program.getSourceFile(`${engine.root}/src/main.ts`);
			const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
			const value = module === undefined ? undefined : checker.getExportsOfModule(module).find((symbol) => symbol.name === "value");
			if (source === undefined || value === undefined) {
				return yield* Effect.die(new Error(`${name} exports no value from src/main.ts`));
			}
			return checker.typeToString(checker.getTypeOfSymbolAtLocation(value, source));
		}),
	}),
});

export function labelsInstalled() {
	return declarationStory.trait("repository", `node_modules/fixture-labels declares Labelled<T> and the edition "first"`, (engine) =>
		Effect.all([
			write(engine, "node_modules/fixture-labels/package.json", JSON.stringify({ name: "fixture-labels", types: "index.d.ts" })),
			write(engine, LABELS, labels("first")),
		]),
	);
}

export function repositoryDeclaresLabels() {
	return declarationStory.trait("repository", "the repository's own src/labels.d.ts declares Labelled<T>", (engine) =>
		write(engine, "src/labels.d.ts", labels("first")),
	);
}
