import { Effect, FileSystem, Path } from "effect";
import { definesModule, readConfig } from "#adapters/typeScript.ts";
import { BuildFailure } from "#BuildFailure.ts";
import { generatorFingerprint, type Project } from "#inputs.ts";

export interface ModuleFile {
	readonly module: string;
	readonly output: string;
}

// A bundler's root may be a folder inside the project, such as src/client, so the project is the nearest folder at or above it
// that holds a tsconfig.json.
export const projectFolder = Effect.fn("Build.projectFolder")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const start = yield* fs.realPath(directory);
	for (let folder = start; ; folder = path.dirname(folder)) {
		if (yield* fs.exists(path.join(folder, "tsconfig.json"))) {
			return folder;
		}
		if (path.dirname(folder) === folder) {
			return yield* new BuildFailure({ message: `${start}: no folder at or above it holds a tsconfig.json, so no project can be found` });
		}
	}
});

export const openProject = Effect.fn("Build.openProject")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(directory);
	const config = yield* readConfig(path.join(root, "tsconfig.json"));
	if (config.files.length === 0 && config.references.length > 0) {
		return yield* new BuildFailure({
			message: `${path.join(root, "tsconfig.json")} holds no files of its own, only references to other projects, so no module can be found; run from the package that holds the modules, or give that package a tsconfig.json that includes them`,
		});
	}
	const project: Project = { config, generated: `${path.join(root, "src", "generated")}${path.sep}`, generator: yield* generatorFingerprint(), root };
	return project;
});

export function sourceFiles(project: Project): readonly string[] {
	return project.config.files.filter((file) => !(file.startsWith(project.generated) || file.endsWith(".d.ts"))).sort();
}

// Every file of the tsconfig that calls defineModule, so no list of modules needs keeping; each writes src/generated/<its path under src>.
export const moduleFiles = Effect.fn("Build.moduleFiles")(function* (project: Project) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const sources = sourceFiles(project);
	const modules = yield* Effect.filter(sources, (file) => Effect.map(fs.readFileString(file), (text) => definesModule(file, text)));
	const source = path.join(project.root, "src");
	return modules.map((module): ModuleFile & { readonly underSource: boolean } => {
		const underSource = path.relative(source, module);
		return { module, output: path.join(project.generated, underSource), underSource: !underSource.startsWith("..") };
	});
});
