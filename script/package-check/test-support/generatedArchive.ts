import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPackedArchive, packArchive } from "#package-check/archive.ts";
import { generatorPath } from "#package-check/generatedOutput.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const NOTES_MODULE = `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { notesWire } from "#generated/notes.ts";

const List = query("list", {
	reads: () => [],
	*run() {
		return ["first note"];
	},
});

export const Notes = defineModule({ name: "notes", operations: [List], requires: [], wire: notesWire });
`;

// A package that ships one defined module, built the way identity's build script builds: generate first, then compile.
class GeneratedFixture extends Context.Service<GeneratedFixture, Package>()("package-check/GeneratedFixture") {
	static layer = Layer.effect(
		GeneratedFixture,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "generated-fixture-" });
			const directory = join(root, "fixture");
			yield* fs.makeDirectory(join(directory, "src"), { recursive: true });
			yield* fs.makeDirectory(join(directory, "dist/generated"), { recursive: true });
			const pkg: Package = {
				directory,
				manifest: {
					files: ["dist", "src"],
					imports: { "#*.ts": { "@shivaedev/source": "./src/*.ts", default: "./dist/*.js" } },
					name: "generated-probe",
					version: "1.0.0",
				},
				tarball: join(root, "fixture.tgz"),
			};
			yield* writeJson(join(directory, "package.json"), { ...pkg.manifest, type: "module" });
			yield* writeJson(join(directory, "tsconfig.json"), { extends: join(ROOT, "tsconfig.base.json"), include: ["src"] });
			yield* fs.symlink(join(ROOT, "node_modules"), join(directory, "node_modules"));
			yield* fs.writeFileString(join(directory, "src/notes.ts"), NOTES_MODULE);
			yield* command(directory, "node", ["--conditions=@shivaedev/source", yield* generatorPath, "generate"]);
			for (const path of ["dist/notes.js", "dist/generated/notes.js"]) {
				yield* fs.writeFileString(join(directory, path), "export {};\n");
			}
			yield* packArchive(pkg);
			return pkg;
		}),
	).pipe(Layer.provideMerge(NodeServices.layer));
}

export const generatedArchive = storyKit({
	after: {
		*archive({ unpacked, packed }) {
			yield* command(unpacked, "tar", ["-czf", packed.tarball, "package"]);
		},
	},
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const fixture = yield* GeneratedFixture;
		const unpacked = yield* fs.makeTempDirectoryScoped({ prefix: "generated-regression-" });
		yield* command(unpacked, "tar", ["-xzf", fixture.tarball]);
		return { packed: { ...fixture, tarball: join(unpacked, "mutated.tgz") }, unpacked };
	},
	layer: GeneratedFixture.layer,
	name: "packed generated output",
	stages: ["archive"],
	verbs: ({ packed }) => ({
		check: () => checkPackedArchive(packed).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
	}),
});

export const generatedFileRemoved = generatedArchive.trait("archive", "the archive no longer holds src/generated/notes.ts", function* ({ unpacked }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.remove(join(unpacked, "package/src/generated/notes.ts"));
});
