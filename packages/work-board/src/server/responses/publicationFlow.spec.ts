import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import {
	folderSwappedAfterSync,
	folderSwappedAtFinalCheck,
	folderSyncRefused,
	readOnlyResponsesFolder,
	responseLinkedOutside,
} from "#test/publicationTraits.ts";

const UNCERTAIN = "publication uncertain: Publication may have completed. Re-read the record identity before retrying.";

boardStory.it(
	"publishing different text under an existing response identity is refused and keeps the existing file",
	[deferredServing, projectFiles({ "responses/response.a.md": "Other contribution" }, "responses/response.a.md records another contribution")],
	function* ({ fileText, publishRecord }) {
		yield* outcomes([
			["existing file", () => fileText("responses/response.a.md"), "Other contribution"],
			[
				"publication",
				() => publishRecord("response.a", "New feedback"),
				"conflict: This identity already records different content; no file was replaced.",
			],
		]);
	},
);

boardStory.it(
	"publishing to a response identity whose file links outside the project is refused, leaves the linked file and no temporary file",
	[deferredServing, responseLinkedOutside("response.link.md")],
	function* ({ folderEntries, outsideFileText, publishRecord }) {
		yield* outcomes([
			["linked file", () => outsideFileText("reference.md"), "Outside source"],
			[
				"publication",
				() => publishRecord("response.link", "New feedback"),
				"unavailable: The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
			],
			["responses folder", () => folderEntries("responses"), ["response.link.md"]],
		]);
	},
);

boardStory.it(
	"publishing into a responses/ that cannot be written is refused and writes no file",
	[deferredServing, readOnlyResponsesFolder()],
	function* ({ folderEntries, publishRecord }) {
		yield* outcomes([
			[
				"publication",
				() => publishRecord("response.a", "Feedback"),
				"unavailable: The local record could not be recorded. Keep the draft and retry after checking local filesystem access.",
			],
			["responses folder", () => folderEntries("responses"), []],
		]);
	},
);

boardStory.it(
	"a publication whose folder sync fails reports that it may have completed, and the record is on disk",
	[deferredServing, folderSyncRefused()],
	function* ({ fileText, publishIntoOpenFolder }) {
		yield* outcomes([
			["publication", () => publishIntoOpenFolder("response.a", "Recorded feedback"), UNCERTAIN],
			["record", () => fileText("responses/response.a.md"), "Recorded feedback"],
		]);
	},
);

boardStory.it(
	"retrying an uncertain publication with the same text completes it without a second file",
	[deferredServing, folderSyncRefused()],
	function* ({ folderEntries, publishIntoOpenFolder }) {
		expect(yield* publishIntoOpenFolder("response.a", "Recorded feedback")).toBe(UNCERTAIN);

		yield* outcomes([
			["responses folder", () => folderEntries("responses"), ["response.a.md"]],
			["retry", () => publishIntoOpenFolder("response.a", "Recorded feedback"), "published"],
		]);
	},
);

boardStory.it(
	"two writers publishing different text under one identity at once publish exactly one",
	[deferredServing],
	function* ({ fileText, folderEntries, publishConcurrently }) {
		yield* outcomes([
			[
				"publications",
				() => publishConcurrently("response.race", ["First feedback", "Other feedback"]),
				["conflict: This identity already records different content; no file was replaced.", "published"],
			],
			["record", () => fileText("responses/response.race.md"), expect.stringMatching(/^(?:First|Other) feedback$/u)],
			["responses folder", () => folderEntries("responses"), ["response.race.md"]],
		]);
	},
);

boardStory.it(
	"four writers publishing the same text under one identity at once all succeed with one file",
	[deferredServing],
	function* ({ folderEntries, publishConcurrently }) {
		yield* outcomes([
			[
				"publications",
				() =>
					publishConcurrently(
						"response.race",
						Array.from({ length: 4 }, () => "Same feedback"),
					),
				Array.from({ length: 4 }, () => "published"),
			],
			["responses folder", () => folderEntries("responses"), ["response.race.md"]],
		]);
	},
);

boardStory.it(
	"a responses/ swapped for an outside link right after the record is synced reports an uncertain publication and writes nothing outside",
	[deferredServing, folderSwappedAfterSync()],
	function* ({ fileText, outsideFolderEntries, publishIntoOpenFolder }) {
		yield* outcomes([
			["other folder", () => outsideFolderEntries(), []],
			["publication", () => publishIntoOpenFolder("response.boundary", "Retained feedback"), UNCERTAIN],
			["record in the moved folder", () => fileText("retained/response.boundary.md"), "Retained feedback"],
		]);
	},
);

boardStory.it(
	"a writer whose responses/ was swapped for an outside link refuses the next publication and writes nothing outside",
	[deferredServing, folderSwappedAfterSync()],
	function* ({ outsideFolderEntries, publishIntoOpenFolder }) {
		expect(yield* publishIntoOpenFolder("response.boundary", "Retained feedback")).toBe(UNCERTAIN);

		yield* outcomes([
			["next publication", () => publishIntoOpenFolder("response.other", "Other feedback"), "conflict: The write boundary changed."],
			["other folder", () => outsideFolderEntries(), []],
		]);
	},
);

boardStory.it(
	"a responses/ swapped for an outside link during the final boundary check reports an uncertain publication and cleans nothing outside",
	[deferredServing, folderSwappedAtFinalCheck()],
	function* ({ fileText, outsideFolderEntries, publishIntoOpenFolder }) {
		yield* outcomes([
			["other folder", () => outsideFolderEntries(), []],
			["publication", () => publishIntoOpenFolder("response.cleanup", "Retained feedback"), UNCERTAIN],
			["record in the moved folder", () => fileText("retained/response.cleanup.md"), "Retained feedback"],
		]);
	},
);
