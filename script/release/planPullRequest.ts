import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { planRelease } from "@shivaedev/changesets/planner.ts";
import config from "#release-config";
import { starterPinsInput } from "./starterPinsInput.ts";

export const planPullRequest = Effect.fn("Release.planPullRequest")(function* (root: string) {
	const plan = yield* planRelease(root, config);
	const fs = yield* FileSystem.FileSystem;
	const pins = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.String)))(
		yield* fs.readFileString(join(root, "examples/starter/published-versions.json")),
	);
	const input = starterPinsInput(plan, pins);
	if (input !== undefined) {
		yield* fs.writeFileString(join(root, ".changeset", input.name), input.text, { flag: "wx" });
		return yield* planRelease(root, config);
	}
	return plan;
});
