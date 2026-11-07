import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem, Path, Schema, SemVer } from "effect";
import { PackageManifest } from "@shivaedev/releases/model.ts";
import { packagePatterns } from "@shivaedev/releases/workspace.ts";
import { git } from "#release/git.ts";
import type { PublishedPackage } from "#release/publishedPackages.ts";
import config from "#release-config";

const Manifest = Schema.fromJsonString(PackageManifest);

export const preparePublish = Effect.fn("Release.preparePublish")(function* (root: string, head: string, before: string) {
	const path = yield* Path.Path;
	const changed = (yield* git(root, "diff", "--no-renames", "--name-only", "--diff-filter=AM", before, head)).split("\n");
	const previousPaths = new Set((yield* git(root, "ls-tree", "-r", "--name-only", before)).split("\n"));
	const packages: PublishedPackage[] = [];
	const manifests = changed.filter(
		(file) =>
			path.basename(file) === "package.json"
			&& packagePatterns(config).some((pattern) =>
				pattern.endsWith("/*") ? path.dirname(path.dirname(file)) === pattern.slice(0, -2) : path.dirname(file) === pattern,
			),
	);
	for (const file of manifests) {
		const current = yield* Schema.decodeUnknownEffect(Manifest)(yield* git(root, "show", `${head}:${file}`));
		if (current.private) {
			continue;
		}
		const previous = previousPaths.has(file)
			? (yield* Schema.decodeUnknownEffect(Manifest)(yield* git(root, "show", `${before}:${file}`))).version
			: "0.0.0";
		const from = yield* Effect.fromResult(SemVer.parse(previous));
		const to = yield* Effect.fromResult(SemVer.parse(current.version));
		if (SemVer.isGreaterThan(to, from)) {
			packages.push({ name: current.name, version: current.version });
		}
	}
	return { base: before, head, packages };
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const path = yield* Path.Path;
			const release = yield* preparePublish(path.resolve("."), yield* Config.String("GITHUB_SHA"), yield* Config.String("CHANGELOG_BASE_REF"));
			const fs = yield* FileSystem.FileSystem;
			yield* fs.writeFileString(
				yield* Config.String("GITHUB_OUTPUT"),
				`publish=${release.packages.length > 0}\nhead=${release.head}\nbase=${release.base}\n`,
				{ flag: "a" },
			);
			yield* Console.log(
				`Push ${release.base}..${release.head}: ${release.packages.map(({ name, version }) => `${name}@${version}`).join(", ") || "no version bumps"}.`,
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
