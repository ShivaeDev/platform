import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, FileSystem, Layer } from "effect";
import { packArchive } from "#package-check/archive.ts";
import { writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export class PackedFixture extends Context.Service<PackedFixture, Package>()("package-check/PackedFixture") {
	static layer = Layer.effect(
		PackedFixture,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const root = yield* fs.makeTempDirectoryScoped({ prefix: "archive-fixture-" });
			const directory = join(root, "fixture");
			for (const path of ["dist", "src"]) {
				yield* fs.makeDirectory(join(directory, path), { recursive: true });
			}
			const pkg: Package = {
				directory,
				manifest: {
					bin: { probe: "./dist/cli.js" },
					exports: { ".": "./dist/library.js" },
					files: ["dist", "src"],
					imports: { "#error": "./dist/error.js" },
					name: "archive-probe",
					peerDependencies: { "@effect/platform-node": "4.0.0", "@effect/platform-node-shared": "4.0.0" },
					version: "1.0.0",
				},
				tarball: join(root, "fixture.tgz"),
			};
			yield* writeJson(join(directory, "package.json"), { ...pkg.manifest, type: "module" });
			for (const [path, source] of Object.entries({
				"dist/cli.js": 'import "#error";\n',
				"dist/error.js": "export const error = 1;\n",
				"dist/error.js.map": JSON.stringify({ sources: ["../src/error.ts"], version: 3 }),
				"dist/library.js": "export {};\n",
				"src/error.ts": "export const error = 1;\n",
			})) {
				yield* fs.writeFileString(join(directory, path), source);
			}
			yield* packArchive(pkg);
			return pkg;
		}),
	).pipe(Layer.provideMerge(NodeServices.layer));
}
