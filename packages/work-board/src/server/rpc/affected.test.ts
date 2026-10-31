import "#test/liveDeliveryBoundary.ts";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { interruptedDelivery } from "#test/interruptedDelivery.ts";
import { liveClientSubscribed } from "#test/liveTraits.ts";
import { unreadableFile } from "#test/servingStoryTraits.ts";

boardStory.it(
	"a home file that renames its identity and switches its dependency names the home, both dependencies, their identities and the old identity, and nothing unrelated",
	[
		projectFiles({
			"nested/home.md": "---\nid: home\nrelationships:\n - kind: informs\n   target: old\n---\n# Home",
			"new.md": "---\nid: new\n---\n# New",
			"old.md": "---\nid: old\n---\n# Old",
			"other.md": "# Unrelated",
		}),
		boardHome("nested/home.md"),
		liveClientSubscribed,
	],
	function* ({ changeNaming, editFile }) {
		editFile("nested/home.md", "---\nid: renamed\nrelationships:\n - kind: informs\n   target: new\n---\n# Changed home");

		expect(yield* changeNaming("nested/home.md")).toEqual([
			"document nested/home.md",
			"document new.md",
			"document old.md",
			"home document",
			"identity home",
			"identity new",
			"identity old",
			"workspace index",
		]);
	},
);

boardStory.it(
	"an edited source names every board, task, result, attention request and note that depends on it",
	[
		projectFiles({
			"board.md": "---\nid: board\nitems: [task]\n---\n# Board",
			"note.md": "# Note\n\n[Read source](source.md)",
			"request.md":
				"---\nid: request\nattention:\n - id: review\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Read this\n   unblocks: [task#done]\n---\n# Request",
			"result.md": "---\nid: result\nevidence:\n - source: source.md\n   criterion: task#done\n---\n# Result",
			"source.md": "# Source",
			"task.md": "---\nid: task\ncriteria:\n - id: done\n   text: Complete\n---\n# Task",
		}),
		liveClientSubscribed,
	],
	function* ({ changeNaming, editFile }) {
		editFile("source.md", "# Updated source");

		expect(yield* changeNaming("source.md")).toEqual(
			expect.arrayContaining([
				"document board.md",
				"document note.md",
				"document request.md",
				"document result.md",
				"document source.md",
				"document task.md",
			]),
		);
	},
);

boardStory.it(
	"a file that duplicates an identity names that identity and the file that held it first",
	[projectFiles({ "first.md": "---\nid: same\n---\n# First" }), liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("duplicate.md", "---\nid: same\n---\n# Duplicate");

		expect(yield* nextChange()).toEqual(expect.arrayContaining(["document first.md", "identity same"]));
	},
);

boardStory.it(
	"removing a duplicate names the shared identity and the file that keeps it",
	[projectFiles({ "duplicate.md": "---\nid: same\n---\n# Duplicate", "first.md": "---\nid: same\n---\n# First" }), liveClientSubscribed],
	function* ({ changeNaming, removeFile }) {
		removeFile("duplicate.md");

		expect(yield* changeNaming("duplicate.md")).toEqual(expect.arrayContaining(["document first.md", "identity same"]));
	},
);

const managedRequest = projectFiles({
	"request.md":
		"---\nid: request\nkind: question\nscope: task\nurgency: whenever\nattention:\n - id: review\n   kind: decision\n   managed: true\n   state: open\n   response_from: [maintainer]\n   reason: Review\n   unblocks: [request]\n---\n# Request",
});

for (const [kind, file, source] of [
	[
		"request receipt",
		"receipt.md",
		`---\nid: receipt\nkind: report\nrequest_receipt:\n question: request\n disposition: superseded\n recordedAt: 0\n reviewedRevision: ${"a".repeat(64)}\n---\n# Receipt`,
	],
	["malformed response", "responses/invalid.md", "---\nresponse: {}\n---\n# Invalid"],
] as const) {
	boardStory.it(
		`a new ${kind} names the managed request it could answer`,
		[managedRequest, liveClientSubscribed],
		function* ({ editFile, nextChange }) {
			editFile(file, source);

			expect(yield* nextChange()).toEqual(expect.arrayContaining(["document request.md"]));
		},
	);
}

boardStory.it(
	"an edit while one file cannot be read reaches a live client as a resync",
	[projectFiles({ "a.md": "# A", "b.md": "# B" }), unreadableFile("b.md"), liveClientSubscribed],
	function* ({ editFile, nextChange }) {
		editFile("a.md", "# Changed A");

		expect(yield* nextChange()).toBe("resync");
	},
);

boardStory.it(
	"an edit the server observes outside the paths it announced reaches a live client as a resync",
	[projectFiles({ "note.md": "# Before" }), interruptedDelivery, liveClientSubscribed],
	function* ({ editFile, nextChange, omitNextPath }) {
		omitNextPath("note.md");
		editFile("note.md", "# Changed outside the announced paths");

		expect(yield* nextChange()).toBe("resync");
	},
);
