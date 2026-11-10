import { join } from "node:path";
import { FileSystem } from "effect";
import { app } from "#starter-published/test-support/app.ts";

export const existingOverrides = app.trait("source", "the workspace has a stale archive, another override and a catalog", function* ({ directory }) {
	yield* (yield* FileSystem.FileSystem).writeFileString(
		join(directory, "pnpm-workspace.yaml"),
		'packages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/old.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/contract": 0.9.0\n',
	);
});

export const failingCi = app.trait("source", "the generated app's ready script fails", function* ({ directory }) {
	yield* (yield* FileSystem.FileSystem).writeFileString(join(directory, "ci.js"), "process.exit(1);\n");
});

export function workerWarning(stream: "stdout" | "stderr") {
	return app.trait("source", `the generated app exits zero with a fork teardown warning on ${stream}`, function* ({ directory }) {
		yield* (yield* FileSystem.FileSystem).writeFileString(
			join(directory, "ci.js"),
			`process.${stream}.write("[vitest-pool]: Timeout terminating forks worker for test files src/first.spec.ts, src/second.dom.spec.ts.\\n");\n`,
		);
	});
}

export const failingBuild = app.trait("source", "the generated app's build script fails", function* ({ directory }) {
	yield* (yield* FileSystem.FileSystem).writeFileString(join(directory, "build.js"), "process.exit(1);\n");
});

export const separateRegistries = app.trait(
	"source",
	"the app still lists its admin modules and its worker modules in separate registries",
	function* ({ directory }) {
		const fs = yield* FileSystem.FileSystem;
		for (const file of ["src/admin/modules.ts", "src/server/workerModules.ts"]) {
			yield* fs.makeDirectory(join(directory, file, ".."), { recursive: true });
			yield* fs.writeFileString(join(directory, file), "export {};\n");
		}
	},
);
