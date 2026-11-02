import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { enclosingRepository } from "#test/enclosingRepository.ts";
import { updates } from "#test/updates.ts";
import { appCommits, createdWith010, published010, starterAt010, starterAt020 } from "#test/updateTraits.ts";

updates.it(
	"a starter deletion preserves my-app's customized file as a named modify/delete conflict, explains resolution and records the minimal app's release",
	[
		starterAt010("ships custom file.txt", { "custom file.txt": "original\n" }),
		createdWith010("--minimal"),
		published010,
		appCommits("customizes custom file.txt", { "custom file.txt": "my-app's content\n" }),
		starterAt020("deletes custom file.txt", { "custom file.txt": null }),
	],
	function* ({ answer, conflictedFiles, exitCode, file, generationRecord, uncommittedChanges, update }) {
		expect(yield* generationRecord()).toEqual({ minimal: true, name: "my-app", version: "0.1.0" });

		yield* update();

		yield* outcomes([
			["conflicted files", () => conflictedFiles(), ["custom file.txt"]],
			["custom file.txt", () => file("custom file.txt"), "my-app's content\n"],
			["modify/delete status", () => uncommittedChanges(), expect.arrayContaining(['UD "custom file.txt"'])],
			["generation record", () => generationRecord(), { minimal: true, name: "my-app", version: "0.2.0" }],
			["exit code", () => exitCode(), 1],
			[
				"resolution guidance",
				() => answer(),
				expect.stringContaining(
					"Starter deletions conflict with app changes:\ncustom file.txt\nKeep a file with git add -- <path>, or accept its deletion with git rm -- <path>.",
				),
			],
		]);
	},
);

updates.it(
	"a mixed starter delta leaves deletion and text conflicts in my-app, applies clean changes, records the release and preserves enclosing repository siblings",
	[
		starterAt010("ships deleted.txt, removed.txt and upgrade.txt", {
			"deleted.txt": "original\n",
			"removed.txt": "unmodified\n",
			"upgrade.txt": "original\n",
		}),
		createdWith010(),
		published010,
		appCommits("customizes deleted.txt and upgrade.txt", { "deleted.txt": "my-app's content\n", "upgrade.txt": "my-app's text\n" }),
		enclosingRepository,
		starterAt020("deletes two files, rewrites upgrade.txt and adds added.txt", {
			"added.txt": "new starter file\n",
			"deleted.txt": null,
			"removed.txt": null,
			"upgrade.txt": "starter text\n",
		}),
	],
	function* ({ conflictedFiles, exitCode, file, generationRecord, repositoryFile, stagedRepositoryFile, uncommittedChanges, update }) {
		yield* update();

		yield* outcomes([
			["conflicted files", () => conflictedFiles(), ["apps/my-app/deleted.txt", "apps/my-app/upgrade.txt"]],
			["deleted.txt", () => file("deleted.txt"), "my-app's content\n"],
			["upgrade.txt", () => file("upgrade.txt"), "<<<<<<< ours\nmy-app's text\n=======\nstarter text\n>>>>>>> theirs\n"],
			["added.txt", () => file("added.txt"), "new starter file\n"],
			["removed.txt", () => file("removed.txt"), "missing"],
			["conflict statuses", () => uncommittedChanges(), expect.arrayContaining(["UD apps/my-app/deleted.txt", "UU apps/my-app/upgrade.txt"])],
			["generation record", () => generationRecord(), { name: "my-app", version: "0.2.0" }],
			["exit code", () => exitCode(), 1],
			["sibling file", () => repositoryFile("added.txt"), "sibling file\n"],
			["staged sibling", () => stagedRepositoryFile("upgrade.txt"), "staged sibling\n"],
			["unstaged sibling", () => repositoryFile("upgrade.txt"), "unstaged sibling\n"],
		]);
	},
);
