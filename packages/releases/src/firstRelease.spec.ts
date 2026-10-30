import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, changeset, newPackage, onMain } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const NEW = "@test/new";
const first = changeset("first", { [NEW]: "minor" });

workspace.it(
	`apply gives the new ${NEW} its 0.1.0 release and its first changelog`,
	[first, newPackage(NEW)],
	function* ({ apply, changelog, todayInUtc, version }) {
		yield* outcomes({
			changelog: [changelog(NEW), "no changelog"],
			version: [version(NEW), "0.0.0"],
		});

		yield* apply();

		yield* outcomes({
			changelog: [changelog(NEW), `# Changelog\n\n## 0.1.0 - ${yield* todayInUtc()}\n\n### Added\n\n- A new feature.\n`],
			version: [version(NEW), "0.1.0"],
		});
	},
);

workspace.it(
	`check accepts ${NEW}'s first release when its changeset is already on main`,
	[first, onMain, newPackage(NEW), applied],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

workspace.it(
	`check refuses ${NEW}'s first release when its changeset was added in the same diff`,
	[first, newPackage(NEW), applied],
	function* ({ check }) {
		expect(yield* check()).toBe("refused: A release needs deleted pending changesets from the base; restore versions and run releases apply.");
	},
);
