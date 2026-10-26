import { join } from "node:path";
import ts from "typescript";
import { linkPackage, type SeedFile, seedTree } from "./tree.ts";

export function seedPackageBuild(files: readonly SeedFile[]): string {
	const root = seedTree(
		[
			{
				content: JSON.stringify({
					imports: { "#*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" } },
					name: "@demo/build",
					type: "module",
				}),
				path: "package.json",
			},
			{
				content: JSON.stringify({
					compilerOptions: { customConditions: ["source"], outDir: "dist", rootDir: "src", types: [] },
					extends: "@shivaedev/quality/tsconfig/package.json",
					include: ["src"],
				}),
				path: "tsconfig.build.json",
			},
		],
		files,
	);
	linkPackage(root);
	return root;
}

export function emittedDeclarations(root: string): { readonly diagnostics: readonly string[]; readonly files: ReadonlyMap<string, string> } {
	const parsed = ts.getParsedCommandLineOfConfigFile(
		join(root, "tsconfig.build.json"),
		{},
		{ ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
	);
	if (parsed === undefined) {
		throw new Error("the build config did not parse");
	}
	const files = new Map<string, string>();
	const result = ts.createProgram({ options: parsed.options, rootNames: parsed.fileNames }).emit(
		undefined,
		(name, text) => {
			files.set(name.slice(join(root, "dist").length + 1), text);
		},
		undefined,
		true,
	);
	return { diagnostics: result.diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")), files };
}
