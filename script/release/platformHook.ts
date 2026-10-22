import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import type { ReleaseHook } from "@shivaedev/changesets/config.ts";
import { ChangesetError } from "@shivaedev/changesets/error.ts";
import { alignStarterPnpm } from "./starterPnpm.ts";

const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));
const constants: Readonly<Record<string, string>> = {
	"@shivaedev/work-board": "packages/work-board/src/server/packageInfo.ts",
	"@shivaedev/work-fleet": "packages/work-fleet/src/packageInfo.ts",
};

export const releasePlatformHook: ReleaseHook = Effect.fn("Release.releasePlatformHook")(function* ({ root, plan }) {
	const fs = yield* FileSystem.FileSystem;
	const pinsPath = join(root, "examples/starter/published-versions.json");
	const pins = yield* Schema.decodeUnknownEffect(Versions)(yield* fs.readFileString(pinsPath)).pipe(
		Effect.mapError(
			(cause) =>
				new ChangesetError({
					cause,
					message: "Fix examples/starter/published-versions.json to map package names to versions, then rerun the release hook.",
				}),
		),
	);
	const updated = { ...pins };
	for (const release of plan.releases) {
		if (Object.hasOwn(updated, release.name)) {
			updated[release.name] = release.to;
		}
		const constant = constants[release.name];
		if (constant !== undefined) {
			const path = join(root, constant);
			const text = yield* fs.readFileString(path);
			const expected = `export const VERSION = "${release.from}";`;
			if (!text.includes(expected)) {
				return yield* new ChangesetError({ message: `${constant}: restore VERSION to ${release.from} before applying the release hook.` });
			}
			yield* fs.writeFileString(path, text.replace(expected, `export const VERSION = "${release.to}";`));
		}
	}
	yield* fs.writeFileString(pinsPath, `${JSON.stringify(updated, null, "\t")}\n`);
	yield* alignStarterPnpm(root);
});
