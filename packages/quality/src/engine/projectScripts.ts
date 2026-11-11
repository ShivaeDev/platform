import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { SetupFailure } from "#failure.ts";

export interface ProjectScripts {
	readonly manager: string;
	readonly scripts: Readonly<Record<string, string>>;
}

const MANAGERS = ["npm", "pnpm", "yarn", "bun"];

export const projectScripts = Effect.fn("Engine.projectScripts")(function* (root: string) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const file = join(root, "package.json");
	const manifest = yield* Effect.mapError(
		readPackageManifest(yield* manifestReader(root), file),
		(cause) => new SetupFailure({ cause, message: `${file} is invalid: ${cause.message}` }),
	);
	const manager = manifest?.packageManager?.split("@")[0] ?? "npm";
	if (!MANAGERS.includes(manager)) {
		return yield* new SetupFailure({ message: `${file}: unsupported packageManager "${manager}". Use npm, pnpm, yarn or bun.` });
	}
	return { manager, scripts: manifest?.scripts ?? {} } satisfies ProjectScripts;
});
