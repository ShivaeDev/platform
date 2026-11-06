import { dirname, relative } from "node:path";
import browserslist from "browserslist";
import { Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";

export function browserTargets(file: string): readonly string[] | undefined {
	const queries = browserslist.loadConfig({ env: "production", path: dirname(file) });
	return queries === undefined ? undefined : browserslist(queries);
}

export const browserOverrides = Effect.fn("Biome.browserOverrides")(function* (root: string) {
	const files = (yield* walk(root)).filter((file) => file.endsWith(".css"));
	const declared = yield* Effect.try({
		catch: (cause) => new SetupFailure({ cause, message: `Cannot resolve declared browser targets: ${String(cause)}` }),
		try: () => files.filter((file) => browserTargets(file) !== undefined).map((file) => posix(relative(root, file))),
	});
	return declared.length === 0
		? []
		: [
				{
					includes: declared,
					linter: { rules: { suspicious: { useBaseline: { level: "error", options: { available: 0 } } } } },
				},
			];
});
