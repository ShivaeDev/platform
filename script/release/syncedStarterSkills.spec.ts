import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { repository } from "#release/test-support/repository.ts";
import { PENDING_INSTRUCTIONS, SYNCED_INSTRUCTIONS, starterSkill } from "#release/test-support/starterSkill.ts";

const COPY = "examples/starter/.agents/skills/story-testing/SKILL.md";
const MANIFEST = "examples/starter/.agents/skills/.shivaedev-skills.json";
const recordedVersion = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })));

repository.it(
	"applying a release of the skills package gives the starter the released instructions under the released version, and the check accepts them",
	[starterSkill],
	function* ({ apply, check, read }) {
		yield* outcomes([
			["starter instructions", () => read(COPY), SYNCED_INSTRUCTIONS],
			["recorded skills version", () => Effect.flatMap(read(MANIFEST), recordedVersion), { version: "0.9.1" }],
		]);

		yield* apply();

		yield* outcomes([
			["starter instructions", () => read(COPY), PENDING_INSTRUCTIONS],
			["recorded skills version", () => Effect.flatMap(read(MANIFEST), recordedVersion), { version: "0.9.2" }],
			["check", () => check(), undefined],
		]);
	},
);

repository.it(
	"the check rejects a starter left on the copy it synced before the skills release and names the repair",
	[starterSkill],
	function* ({ apply, check, read, write }) {
		const manifestBeforeRelease = yield* read(MANIFEST);
		yield* apply();
		expect(yield* check()).toBeUndefined();

		yield* write(COPY, SYNCED_INSTRUCTIONS);
		yield* write(MANIFEST, manifestBeforeRelease);

		expect(yield* check()).toBe(
			"examples/starter: The shared skills are out of sync:\n- The skills were synced from @shivaedev/skills 0.9.1, but 0.9.2 is installed.\nRun `shivaedev-skills sync` and commit the result. In examples/starter that is pnpm skills:sync, and pnpm releases apply runs it for a release.",
		);
	},
);
