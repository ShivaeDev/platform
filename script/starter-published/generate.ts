import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { command, writeJson } from "#package-check/io.ts";
import { packedInstaller } from "./packedInstaller.ts";

export const generateStarter = Effect.fn("Published.generateStarter")(function* (
	root: string,
	temporary: string,
	archive?: string,
	tarballs: Readonly<Record<string, string>> = {},
	registryVersion?: string,
) {
	if (registryVersion !== undefined) {
		yield* Effect.log(`Generating and installing a generated app with pnpm create @shivaedev/app@${registryVersion}.`);
		yield* Effect.log(
			yield* command(temporary, "env", [
				"npm_config_registry=https://registry.npmjs.org",
				"pnpm",
				"create",
				`@shivaedev/app@${registryVersion}`,
				"demo",
			]),
		);
		return;
	}
	const fs = yield* FileSystem.FileSystem;
	const packed = archive === undefined ? join(temporary, "create-app.tgz") : resolve(root, archive);
	if (archive === undefined) {
		yield* command(root, "pnpm", ["--filter", "@shivaedev/create-app", "build"]);
		yield* command(join(root, "packages/create-app"), "pnpm", ["pack", "--out", packed]);
	}
	const generator = join(temporary, "generator");
	yield* fs.makeDirectory(generator);
	yield* writeJson(join(generator, "package.json"), { dependencies: { "@shivaedev/create-app": `file:${packed}` }, private: true });
	yield* fs.writeFileString(join(generator, "pnpm-workspace.yaml"), "packages: []\n");
	yield* command(generator, "pnpm", ["install", "--registry=https://registry.npmjs.org"]);
	yield* Effect.log("Generating and installing a generated app with the packed create-app command.");
	const bin = join(generator, "node_modules/.bin/create-app");
	if (Object.keys(tarballs).length === 0) {
		yield* command(temporary, bin, ["demo"]);
	} else {
		const path = yield* packedInstaller(root, temporary, tarballs);
		yield* command(temporary, "env", [`PATH=${path}`, bin, "demo"]);
	}
});
