import { Effect, Path } from "effect";
import type { Package } from "#package-check/model.ts";
import { checkAdoption } from "#starter-published/checkAdoption.ts";
import { checkTooling } from "#starter-published/checkTooling.ts";
import { generateStarter } from "#starter-published/generate.ts";
import { phase } from "#starter-published/phase.ts";
import { upgradeStarter } from "#starter-published/upgrade.ts";

export const checkStarters = Effect.fn("Published.checkStarters")(function* (
	root: string,
	temporary: string,
	packages: readonly Package[],
	database: string,
	variants: readonly boolean[] = [false, true],
) {
	const path = yield* Path.Path;
	for (const minimal of variants) {
		const variant = minimal ? "minimal" : "full";
		const { folder, tarballs } = yield* phase(`${variant} generate and install`, generateStarter(root, temporary, packages, minimal));
		yield* phase(`${variant} app ci and tooling`, checkTooling(path.join(temporary, folder), database));
		if (!minimal) {
			yield* phase(`${variant} adoption`, checkAdoption(root, path.join(temporary, folder), database));
		}
		const current = path.join(temporary, minimal ? "generator-minimal" : "generator", "node_modules/.bin/create-app");
		yield* phase(`${variant} upgrade total`, upgradeStarter(root, temporary, path.join(temporary, folder), current, tarballs, database, minimal));
		yield* Effect.log(
			`Packed ${minimal ? "minimal" : "full"} app upgraded with real installs, typechecks and PostgreSQL/HTTP stories without skips.`,
		);
	}
});
