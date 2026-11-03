import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path, Schema } from "effect";
import type { SetupFailure } from "#failure.ts";
import type { RuleServices } from "#rule.ts";
import { FilesystemFailure, readRequiredText } from "./filesystem.ts";
import { posix } from "./ignoreScope.ts";
import { shadcnAlias } from "./shadcnAlias.ts";
import { walk } from "./walk.ts";

const Components = Schema.fromJsonString(Schema.Struct({ aliases: Schema.Struct({ ui: Schema.NonEmptyString }) }));

export const shadcnFolders = Effect.fn("Inventory.shadcnFolders")(function* (
	root: string,
): Effect.fn.Return<readonly string[], FilesystemFailure | SetupFailure, RuleServices> {
	const { basename } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const paths = (yield* walk(root)).filter((path) => basename(path) === "components.json");
	return yield* Effect.forEach(paths, (path) =>
		Effect.gen(function* () {
			const { dirname, relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

			const text = yield* readRequiredText(path);
			return yield* Effect.try({
				catch: (cause) => new FilesystemFailure({ message: `cannot resolve ${path}: ${String(cause)}`, path }),
				try: () => {
					const { aliases } = Schema.decodeUnknownSync(Components)(text);
					const folder = posix(relative(root, shadcnAlias(dirname(path), aliases.ui)));
					if (folder === "" || folder === ".." || folder.startsWith("../")) {
						throw new Error("the shadcn UI folder must be inside the repository and cannot be its root");
					}
					return folder;
				},
			});
		}),
	);
});
