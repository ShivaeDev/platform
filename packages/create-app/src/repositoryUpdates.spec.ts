import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { enclosingRepository } from "#test/enclosingRepository.ts";
import { updates } from "#test/updates.ts";
import { appCommits, appEditsWithoutCommitting, createdWith010, published010, starterAt010, starterAt020 } from "#test/updateTraits.ts";

const shipsUpgrade = starterAt010("ships upgrade.txt reading original", { "upgrade.txt": "original\n" });
const changesUpgrade = starterAt020("rewrites upgrade.txt", { "upgrade.txt": "starter content\n" });

for (const layout of ["standalone", "enclosing"] as const) {
	const repository = layout === "enclosing" ? [enclosingRepository] : [];
	updates.it(
		`update changes and adds starter files before advancing the record in the ${layout} repository`,
		[
			shipsUpgrade,
			createdWith010(),
			published010,
			...repository,
			starterAt020("rewrites upgrade.txt and adds added.txt", { "added.txt": "new file\n", "upgrade.txt": "starter content\n" }),
		],
		function* ({ exitCode, file, generationRecord, update }) {
			yield* outcomes([
				["added.txt", () => file("added.txt"), "missing"],
				["upgrade.txt", () => file("upgrade.txt"), "original\n"],
				["generation record", () => generationRecord(), { version: "0.1.0" }],
			]);

			yield* update();

			yield* outcomes([
				["added.txt", () => file("added.txt"), "new file\n"],
				["upgrade.txt", () => file("upgrade.txt"), "starter content\n"],
				["generation record", () => generationRecord(), { version: "0.2.0" }],
				["exit code", () => exitCode(), 0],
			]);
		},
	);

	updates.it(
		`update refuses uncommitted app edits and retains the record in the ${layout} repository before fetching an unpublished release`,
		[
			shipsUpgrade,
			createdWith010(),
			...repository,
			appEditsWithoutCommitting("rewrites upgrade.txt as a draft", { "upgrade.txt": "app draft\n" }),
			changesUpgrade,
		],
		function* ({ answer, exitCode, file, generationRecord, update }) {
			yield* update();

			yield* outcomes([
				["generation record", () => generationRecord(), { version: "0.1.0" }],
				["upgrade.txt", () => file("upgrade.txt"), "app draft\n"],
				["exit code", () => exitCode(), 1],
				["answer", () => answer(), "create-app: Refusing to update a dirty working tree. Commit or stash your changes first."],
			]);
		},
	);

	updates.it(
		`update refuses a starter delta that applies nothing and retains the record in the ${layout} repository`,
		[
			shipsUpgrade,
			createdWith010(),
			published010,
			appCommits("already adopts the starter delta", { "upgrade.txt": "starter content\n" }),
			...repository,
			changesUpgrade,
		],
		function* ({ answer, exitCode, generationRecord, update }) {
			expect(yield* generationRecord()).toMatchObject({ version: "0.1.0" });

			yield* update();

			yield* outcomes([
				["generation record", () => generationRecord(), { version: "0.1.0" }],
				["exit code", () => exitCode(), 1],
				["answer", () => answer(), "create-app: The starter delta applied no changes. The generation record is unchanged."],
			]);
		},
	);
}

updates.it(
	"update preserves sibling files and their staged and unstaged content in the enclosing repository",
	[shipsUpgrade, createdWith010(), published010, enclosingRepository, changesUpgrade],
	function* ({ exitCode, repositoryFile, stagedRepositoryFile, update }) {
		yield* outcomes([
			["sibling file", () => repositoryFile("added.txt"), "sibling file\n"],
			["staged sibling", () => stagedRepositoryFile("upgrade.txt"), "staged sibling\n"],
			["unstaged sibling", () => repositoryFile("upgrade.txt"), "unstaged sibling\n"],
		]);

		yield* update();

		yield* outcomes([
			["exit code", () => exitCode(), 0],
			["sibling file", () => repositoryFile("added.txt"), "sibling file\n"],
			["staged sibling", () => stagedRepositoryFile("upgrade.txt"), "staged sibling\n"],
			["unstaged sibling", () => repositoryFile("upgrade.txt"), "unstaged sibling\n"],
		]);
	},
);
