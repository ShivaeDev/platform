import { Effect, Path } from "effect";
import { checkTooling } from "#starter-published/checkTooling.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { runStarter } from "#starter-published/run.ts";
import { upgradeStarter } from "#starter-published/upgrade.ts";

export const checkStarters = Effect.fn("Published.checkStarters")(function* (
	root: string,
	temporary: string,
	tarballs: Readonly<Record<string, string>>,
	database: string,
	registryVersion?: string,
	variants: readonly boolean[] = [false, true],
) {
	const path = yield* Path.Path;
	for (const minimal of variants) {
		const folder = yield* generateStarter(root, temporary, tarballs["@shivaedev/create-app"], tarballs, registryVersion, minimal);
		yield* runStarter(path.join(temporary, folder), database);
		if (registryVersion === undefined) {
			yield* checkTooling(path.join(temporary, folder));
			const current = path.join(temporary, minimal ? "generator-minimal" : "generator", "node_modules/.bin/create-app");
			yield* upgradeStarter(root, temporary, current, tarballs, database, minimal);
			yield* Effect.log(
				`Packed ${minimal ? "minimal" : "full"} app upgraded with real installs, typechecks and PostgreSQL/HTTP stories without skips.`,
			);
		}
	}
});
