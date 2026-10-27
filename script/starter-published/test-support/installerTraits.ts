import { join } from "node:path";
import { FileSystem } from "effect";
import { writeJson } from "#package-check/io.ts";
import { app } from "./app.ts";

export const existingOverrides = app.trait("source", "the workspace has a stale archive, another override and a catalog", function* ({ directory }) {
	yield* (yield* FileSystem.FileSystem).writeFileString(
		join(directory, "pnpm-workspace.yaml"),
		'packages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/old.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/contract": 0.9.0\n',
	);
});

export const noPackedDependencies = app.trait("source", "the app has no packed dependencies", function* (engine) {
	engine.tarballs = {};
	yield* writeJson(join(engine.directory, "package.json"), { private: true });
});

export const failingCi = app.trait("source", "the generated app's CI script fails", function* ({ directory }) {
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
