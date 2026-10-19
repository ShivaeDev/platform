import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { prepareArchives, verifyArchives, workspaceArchives } from "#package-check/archives.ts";
import { command } from "#package-check/io.ts";
import { decodeVersions } from "#package-check/model.ts";
import { checkDocumentation, readDocumentation } from "./documentation.ts";
import { installDocumentation } from "./installDocumentation.ts";

export const workspaceDocumentation = Effect.fn("Published.workspaceDocumentation")(function* (
	root: string,
	temporary: string,
	options: { readonly archives?: string | undefined; readonly registry: boolean },
) {
	const fs = yield* FileSystem.FileSystem;
	const versions = { ...decodeVersions(yield* fs.readFileString(join(root, "examples/starter/published-versions.json"))) };
	let tarballs: Readonly<Record<string, string>> = {};
	if (options.archives !== undefined || options.registry) {
		const archives = options.archives === undefined ? join(temporary, "packages") : resolve(root, options.archives);
		const packages = yield* workspaceArchives(root, archives);
		if (options.registry) {
			yield* Effect.log("Building and packing workspace packages for the current documentation.");
			yield* command(root, "pnpm", ["build"]);
			yield* prepareArchives(packages, archives);
		}
		yield* verifyArchives(packages, archives);
		tarballs = Object.fromEntries(packages.map((pkg) => [pkg.manifest.name, pkg.tarball]));
		for (const pkg of packages) {
			if (pkg.manifest.name in versions) {
				versions[pkg.manifest.name] = pkg.manifest.version;
			}
		}
	}
	const source = Object.keys(tarballs).length === 0 ? "pinned npm releases" : "packed workspace versions";
	const entries = yield* readDocumentation(root, versions);
	const documentation = join(temporary, "documentation");
	yield* Effect.log(`Installing documented framework APIs from ${source}.`);
	yield* installDocumentation(root, documentation, versions, tarballs);
	yield* checkDocumentation(documentation, entries, versions, source);
	return options.registry ? {} : tarballs;
});
