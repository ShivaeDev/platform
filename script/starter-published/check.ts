import { Effect, Path } from "effect";
import { generateStarter } from "#starter-published/generate.ts";
import { runStarter } from "#starter-published/run.ts";
import { upgradeStarter } from "#starter-published/upgrade.ts";

export const checkStarters = Effect.fn("Published.checkStarters")(function* (
	root: string,
	temporary: string,
	tarballs: Readonly<Record<string, string>>,
	database: string,
	registryVersion?: string,
) {
	const path = yield* Path.Path;
	for (const minimal of [false, true]) {
		const folder = yield* generateStarter(root, temporary, tarballs["@shivaedev/create-app"], tarballs, registryVersion, minimal);
		yield* runStarter(path.join(temporary, folder), database);
		if (registryVersion === undefined) {
			const current = path.join(temporary, minimal ? "generator-minimal" : "generator", "node_modules/.bin/create-app");
			yield* upgradeStarter(root, temporary, current, tarballs, database, minimal);
		}
	}
	if (registryVersion === undefined) {
		yield* Effect.log("Packed full and minimal apps upgraded with real installs, typechecks and PostgreSQL/HTTP stories without skips.");
	}
});
