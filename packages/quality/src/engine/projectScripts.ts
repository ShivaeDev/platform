import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { SetupFailure } from "#failure.ts";

export interface ProjectScripts {
	readonly manager: string;
	readonly scripts: readonly string[];
}

const MANAGERS = ["npm", "pnpm", "yarn", "bun"];

export const projectScripts = Effect.fn("Engine.projectScripts")(function* (root: string, wanted: readonly string[]) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const file = join(root, "package.json");
	const manifest = yield* readPackageManifest(yield* manifestReader(root), file);
	const scripts = wanted.filter((script) => manifest?.scripts?.[script] !== undefined);
	const manager = manifest?.packageManager?.split("@")[0] ?? "npm";
	if (scripts.length > 0 && !MANAGERS.includes(manager)) {
		return yield* new SetupFailure({ message: `${file}: unsupported packageManager "${manager}". Use npm, pnpm, yarn or bun.` });
	}
	return { manager, scripts } satisfies ProjectScripts;
});
