import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Option, Path } from "effect";
import { AGENTS_SKILLS, CLAUDE_SKILLS, MANIFEST } from "@shivaedev/skills/layout.ts";
import { readManifest } from "@shivaedev/skills/manifest.ts";
import { FilesystemFailure } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";

export const skillCopies = Effect.fn("Inventory.skillCopies")(function* (root: string) {
	const { dirname, join, sep } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const paths = yield* walk(root);
	const manifests = paths.filter((path) => posix(path).endsWith(`/${MANIFEST}`));
	const owned = yield* Effect.forEach(manifests, (file) =>
		Effect.gen(function* () {
			const repo = dirname(dirname(dirname(file)));
			const manifest = yield* readManifest(repo).pipe(
				Effect.provide(NodePath.layer),
				Effect.mapError((cause) => new FilesystemFailure({ message: cause.message, path: file })),
			);
			return Option.isNone(manifest)
				? []
				: [file, ...Object.keys(manifest.value.skills).flatMap((name) => [join(repo, AGENTS_SKILLS, name), join(repo, CLAUDE_SKILLS, name)])];
		}),
	);
	const prefixes = owned.flat();
	return {
		owns: (path: string) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}${sep}`)),
		paths: prefixes,
	};
});
