import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { vendorTypes } from "#package-check/adapters/vendorTypes.ts";
import { checkPackedArchive, packArchive } from "#package-check/archive.ts";
import { writeJson } from "#package-check/io.ts";
import { type VendorTypeException, vendorTypeProblems } from "#package-check/vendorTypeExceptions.ts";

const nativeEngine: VendorTypeException = {
	dependency: "@vendor/engine",
	files: ["dist/library.d.ts", "dist/native.d.ts"],
	name: "native-engine-options",
	package: "declaration-probe",
	reason: "The engine integration accepts native engine options.",
};

export const vendorDeclarations = storyKit({
	after: {
		*build({ directory, manifest, tarball }) {
			const fs = yield* FileSystem.FileSystem;
			const files = yield* fs.readDirectory(join(directory, "src"), { recursive: true });
			const program = ts.createProgram(
				files.filter((file) => file.endsWith(".ts")).map((file) => join(directory, "src", file)),
				{
					customConditions: ["@shivaedev/source"],
					declaration: true,
					module: ts.ModuleKind.NodeNext,
					outDir: join(directory, "dist"),
					rootDir: join(directory, "src"),
					skipLibCheck: true,
					strict: true,
				},
			);
			const diagnostics = ts.getPreEmitDiagnostics(program);
			if (diagnostics.length > 0) {
				throw new Error(
					ts.formatDiagnosticsWithColorAndContext(diagnostics, {
						getCanonicalFileName: (file) => file,
						getCurrentDirectory: () => directory,
						getNewLine: () => "\n",
					}),
				);
			}
			program.emit();
			yield* packArchive({ directory, manifest, tarball });
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const directory = yield* fs.makeTempDirectoryScoped({ prefix: "vendor-declarations-" });
		const manifest = {
			dependencies: { "@vendor/engine": "1.0.0" },
			devDependencies: { "@types/dev-data": "1.0.0", "dev-engine": "1.0.0", "peer-engine": "1.0.0" },
			exports: { ".": { types: "./dist/library.d.ts" } },
			files: ["dist", "src"],
			imports: { "#*.ts": { "@shivaedev/source": "./src/*.ts", types: "./dist/*.d.ts" } },
			name: "declaration-probe",
			optionalDependencies: { "optional-engine": "1.0.0" },
			peerDependencies: { "@shivaedev/service": "1.0.0", "effect": "1.0.0", "peer-engine": "1.0.0" },
			peerDependenciesMeta: { "peer-engine": { optional: true } },
			type: "module",
			version: "1.0.0",
		};
		yield* writeJson(join(directory, "package.json"), manifest);
		for (const name of ["@vendor/engine", "@types/dev-data", "dev-engine", "peer-engine", "optional-engine", "effect", "@shivaedev/service"]) {
			const dependency = join(directory, "node_modules", name);
			yield* fs.makeDirectory(dependency, { recursive: true });
			yield* writeJson(join(dependency, "package.json"), { name, types: "index.d.ts", version: "1.0.0" });
			yield* fs.writeFileString(
				join(dependency, "index.d.ts"),
				"export interface Options { readonly timeout: number }; export declare function options(): Options;\n",
			);
		}
		const transitive = join(directory, "node_modules/transitive-engine");
		yield* fs.makeDirectory(transitive);
		yield* writeJson(join(transitive, "package.json"), { name: "transitive-engine", types: "index.d.ts", version: "1.0.0" });
		yield* fs.writeFileString(join(transitive, "index.d.ts"), "export interface Result { readonly engineVersion: string }\n");
		yield* fs.writeFileString(
			join(directory, "node_modules/@vendor/engine/result.d.ts"),
			'export declare function result(): import("transitive-engine").Result;\n',
		);
		yield* writeJson(join(directory, "node_modules/@vendor/engine/package.json"), {
			dependencies: { "transitive-engine": "1.0.0" },
			name: "@vendor/engine",
			types: "index.d.ts",
			version: "1.0.0",
		});
		yield* fs.makeDirectory(join(directory, "src"));
		yield* fs.writeFileString(join(directory, "src/library.ts"), "export {};\n");
		return { directory, manifest, tarball: join(directory, "fixture.tgz") };
	},
	layer: NodeServices.layer,
	name: "vendor types in emitted package declarations",
	stages: ["source", "build"],
	verbs: (pkg) => ({
		check: () => checkPackedArchive(pkg).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
		checkNamedException: Effect.fn("VendorDeclarations.checkNamedException")(function* () {
			const fs = yield* FileSystem.FileSystem;
			const files = yield* fs.readDirectory(join(pkg.directory, "dist"), { recursive: true });
			const sources = new Map(
				yield* Effect.forEach(
					files.filter((file) => file.endsWith(".d.ts")),
					(file) => Effect.map(fs.readFileString(join(pkg.directory, "dist", file)), (source) => [`dist/${file}`, source] as const),
				),
			);
			return vendorTypeProblems(pkg.manifest.name, vendorTypes(pkg.manifest, sources), [nativeEngine]);
		}),
	}),
});

export function declaration(source: string, modules: Readonly<Record<string, string>> = {}) {
	return vendorDeclarations.trait("source", "a package with a public declaration", function* ({ directory }) {
		const fs = yield* FileSystem.FileSystem;
		for (const [file, contents] of Object.entries({ "library.ts": source, ...modules })) {
			const path = join(directory, "src", file);
			yield* fs.makeDirectory(join(path, ".."), { recursive: true });
			yield* fs.writeFileString(path, contents);
		}
	});
}

export const wildcardDeclarations = vendorDeclarations.trait("source", "wildcard exports hide internal modules", function* ({ directory, manifest }) {
	yield* writeJson(join(directory, "package.json"), {
		...manifest,
		exports: {
			"./*.ts": { "@shivaedev/source": "./src/*.ts", types: "./dist/*.d.ts" },
			"./internal/*.ts": null,
		},
	});
});

export const javascriptExport = vendorDeclarations.trait(
	"source",
	"a JavaScript export resolves its sibling declaration",
	function* ({ directory, manifest }) {
		yield* writeJson(join(directory, "package.json"), { ...manifest, exports: { ".": "./dist/library.js" } });
	},
);
