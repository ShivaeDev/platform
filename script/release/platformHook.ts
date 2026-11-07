import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import type { ReleaseHook } from "@shivaedev/releases/config.ts";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { alignStarterCatalog } from "#release/starterCatalog.ts";
import { alignStarterPnpm } from "#release/starterPnpm.ts";

const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

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
	}
	yield* fs.writeFileString(pinsPath, `${JSON.stringify(updated, null, "\t")}\n`);
	yield* alignStarterPnpm(root);
	yield* alignStarterCatalog(root);
});
