import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { planRelease } from "@shivaedev/changesets/planner.ts";
import config from "#release-config";

export const planPullRequest = Effect.fn("Release.planPullRequest")(function* (root: string) {
	const plan = yield* planRelease(root, config);
	const fs = yield* FileSystem.FileSystem;
	const pins = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.String)))(
		yield* fs.readFileString(join(root, "examples/starter/published-versions.json")),
	);
	if (
		plan.releases.some((release) => Object.hasOwn(pins, release.name))
		&& !plan.releases.some((release) => release.name === "@shivaedev/create-app")
	) {
		yield* fs.writeFileString(
			join(root, ".changeset/release-starter-pins.md"),
			'---\n"@shivaedev/create-app": patch\n---\n\n### Changed\n\n- Generated apps use the latest released starter dependencies.\n',
			{ flag: "wx" },
		);
		return yield* planRelease(root, config);
	}
	return plan;
});
