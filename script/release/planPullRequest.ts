import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { planRelease } from "@shivaedev/releases/planner.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { frameworkVersionsInput } from "#release/frameworkVersionsInput.ts";
import { starterPinsInput } from "#release/starterPinsInput.ts";
import config from "#release-config";

export const planPullRequest = Effect.fn("Release.planPullRequest")(function* (root: string) {
	let plan = yield* planRelease(root, config);
	const fs = yield* FileSystem.FileSystem;
	const workspace = yield* readWorkspace(root, config);
	const frameworkInput = yield* frameworkVersionsInput(root, workspace.packages, plan);
	if (frameworkInput !== undefined) {
		yield* fs.writeFileString(join(root, ".changeset", frameworkInput.name), frameworkInput.text, { flag: "wx" });
		plan = yield* planRelease(root, config);
	}
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
