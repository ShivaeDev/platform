import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

export function decisionSources(root: string, sources: Readonly<Record<string, string>>) {
	const base = resolve(root);
	const files: string[] = [];
	function scan(directory: string) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === "test-support") {
				continue;
			}
			const file = join(directory, entry.name);
			if (entry.isDirectory()) {
				scan(file);
			} else if (entry.name.endsWith(".ts") && !/\.(?:test|spec)\.ts$/u.test(entry.name)) {
				files.push(file);
			}
		}
	}
	scan(base);
	const options: ts.CompilerOptions = {
		allowImportingTsExtensions: true,
		baseUrl: base,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noLib: true,
		noResolve: true,
		paths: { "#*": ["*"] },
		skipLibCheck: true,
		types: [],
	};
	const host = ts.createCompilerHost(options);
	const originalRead = host.readFile;
	const overrides = new Map(Object.entries(sources).map(([file, content]) => [resolve(base, file), content]));
	for (const file of overrides.keys()) {
		if (!files.includes(file)) {
			files.push(file);
		}
	}
	const originalExists = host.fileExists;
	host.fileExists = (file) => overrides.has(resolve(file)) || originalExists(file);
	host.readFile = (file) => overrides.get(resolve(file)) ?? originalRead(file);
	const program = ts.createProgram(files, options, host);
	return { checker: program.getTypeChecker(), trees: files.map((file) => program.getSourceFile(file)).filter((tree) => tree !== undefined) };
}
