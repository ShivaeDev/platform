import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { command } from "#package-check/io.ts";
import { bins, decodeVersions, effectPackage, type Package } from "#package-check/model.ts";
import { withTarballOverrides } from "#packed-workspace.ts";

export const consumerWorkspace = (root: string, pkg: Package, tarballs: Readonly<Record<string, string>>) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		let workspace = yield* fs.readFileString(join(root, "pnpm-workspace.yaml"));
		if (Object.keys(bins(pkg.manifest)).length > 0) {
			const overrides = decodeVersions(yield* command(root, "pnpm", ["config", "get", "overrides", "--json"]));
			const retained = Object.entries(overrides)
				.filter(([name]) => !effectOverride(name))
				.map(([name, version]) => `  ${JSON.stringify(name)}: ${JSON.stringify(version)}\n`)
				.join("");
			workspace = workspace.replace(/^overrides:[ \t]*\n(?:(?:[ \t].*)?\n)*/mu, "");
			if (retained !== "") {
				workspace = `${workspace.trimEnd()}\n\noverrides:\n${retained}`;
			}
		}
		return withTarballOverrides(workspace, tarballs);
	});

const effectOverride = (selector: string): boolean => {
	const target = selector.split(">").at(-1) ?? selector;
	return effectPackage(target) || target.startsWith("effect@");
};
