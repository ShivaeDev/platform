import { dirname, join, relative } from "node:path";
import ts from "typescript";
import type { Finding, Findings } from "#rule.ts";

export interface Project {
	readonly cache: ts.ModuleResolutionCache;
	readonly files: ReadonlySet<string>;
	readonly options: ts.CompilerOptions;
	readonly typesCache: ts.ModuleResolutionCache;
	readonly typesOptions: ts.CompilerOptions;
}

interface ParsedProject {
	readonly files: ReadonlySet<string>;
	readonly key: string;
	readonly options: ts.CompilerOptions;
	readonly references: readonly string[];
}

const CONFIG = "tsconfig.json";

function resolutionOptions(options: ts.CompilerOptions, declarations: boolean): ts.CompilerOptions {
	return {
		...options,
		noDtsResolution: !declarations,
	};
}

function projectOf(root: string, parsed: ParsedProject | undefined): Project {
	const options = parsed?.options ?? {
		allowJs: true,
		customConditions: ["source"],
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		resolveJsonModule: true,
	};
	const runtime = resolutionOptions(options, false);
	const types = resolutionOptions(options, true);
	return {
		cache: ts.createModuleResolutionCache(root, (file) => file, runtime),
		files: parsed?.files ?? new Set(),
		options: runtime,
		typesCache: ts.createModuleResolutionCache(root, (file) => file, types),
		typesOptions: types,
	};
}

function parse(path: string, report: (diagnostic: ts.Diagnostic, config: string) => void): ParsedProject {
	const parsed = ts.getParsedCommandLineOfConfigFile(
		path,
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: (diagnostic) => report(diagnostic, path),
			readFile: (file) => {
				const contents = ts.sys.readFile(file);
				if (contents !== undefined) {
					const diagnostic = ts.parseConfigFileTextToJson(file, contents).error;
					if (diagnostic !== undefined) {
						report(diagnostic, file);
					}
				}
				return contents;
			},
		},
	);
	for (const diagnostic of parsed?.errors ?? []) {
		report(diagnostic, path);
	}
	return {
		files: new Set(parsed?.fileNames ?? []),
		key: path,
		options: parsed?.options ?? {},
		references: (parsed?.projectReferences ?? []).map((reference) => ts.resolveProjectReferencePath(reference)),
	};
}

function nearestConfig(root: string, file: string): string | undefined {
	for (let directory = dirname(file); !relative(root, directory).startsWith(".."); directory = dirname(directory)) {
		const candidate = join(directory, CONFIG);
		if (ts.sys.fileExists(candidate)) {
			return candidate;
		}
		if (directory === root) {
			return undefined;
		}
	}
	return undefined;
}

function memo<TValue>(compute: (key: string) => TValue): (key: string) => TValue {
	const known = new Map<string, TValue>();
	return (key) => {
		const value = known.get(key) ?? compute(key);
		known.set(key, value);
		return value;
	};
}

// A file resolves with the options of the project that includes it: the nearest tsconfig.json, or a project it references.
export function projectsFor(root: string): ((file: string) => Project) & { readonly findings: Findings } {
	const findings: Finding[] = [];
	const reported = new Set<string>();
	const parsedAt = memo((path) =>
		parse(path, (diagnostic, config) => {
			const file = relative(root, diagnostic.file?.fileName ?? config).replaceAll("\\", "/");
			const line =
				diagnostic.file !== undefined && diagnostic.start !== undefined
					? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
					: undefined;
			const message = `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")} Repair the tsconfig before trusting import findings.`;
			const key = `${file}:${line}:${message}`;
			if (!reported.has(key)) {
				reported.add(key);
				findings.push({ file, line, message, subject: `TS${diagnostic.code}` });
			}
		}),
	);
	function withReferences(path: string, seen: Set<string>): readonly ParsedProject[] {
		if (seen.has(path)) {
			return [];
		}
		seen.add(path);
		const project = parsedAt(path);
		return [project, ...project.references.flatMap((reference) => withReferences(reference, seen))];
	}
	const familyAt = memo((config) => withReferences(config, new Set()));
	const projects = new Map<string, Project>();
	return Object.assign(
		(file: string) => {
			const config = nearestConfig(root, file);
			const owner = config === undefined ? undefined : (familyAt(config).find((candidate) => candidate.files.has(file)) ?? parsedAt(config));
			const key = owner?.key ?? "";
			const project = projects.get(key) ?? projectOf(root, owner);
			projects.set(key, project);
			return project;
		},
		{ findings },
	);
}
