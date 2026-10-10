import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { syncSkills } from "#syncSkills.ts";
import { exists, it, removeFixtures, select, writeFile } from "#test/fixture.ts";

afterEach(removeFixtures);

it.each(["{", '{"skills":[],"version":1}'])(
	"a damaged sync manifest gives repair instructions and leaves copies intact: %s",
	function* (manifest, { installed, repo }) {
		yield* select(repo, ["alpha"]);
		yield* syncSkills(repo, installed);
		yield* writeFile(".agents/skills/.shivaedev-skills.json", manifest)(repo);

		const error = yield* Effect.flip(syncSkills(repo, installed));

		expect(error.message).toBe(
			".agents/skills/.shivaedev-skills.json is not a manifest this package wrote. Delete it and the folders it listed, then sync.",
		);
		expect(yield* exists(repo, ".agents/skills/alpha/SKILL.md")).toBe(true);
	},
);

it.each(["{", '{"shivaedevSkills":"alpha"}', '{"shivaedevSkills":[1]}'])(
	"an invalid consumer selection names the field to fix: %s",
	function* (manifest, { installed, repo }) {
		yield* writeFile("package.json", manifest)(repo);

		const error = yield* Effect.flip(syncSkills(repo, installed));

		expect(error.message).toBe(`${repo}/package.json: "shivaedevSkills" must be a list of skill names.`);
		expect(yield* exists(repo, ".agents/skills/.shivaedev-skills.json")).toBe(false);
	},
);
