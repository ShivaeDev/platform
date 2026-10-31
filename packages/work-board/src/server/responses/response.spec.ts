import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { MODEL_REVIEW } from "#test/questionRecordState.ts";
import { aModelReview, questionRegistered, replyRecorded, responsesFolderLinkedOutside } from "#test/questionRecordTraits.ts";

const CHANGED_MODEL = MODEL_REVIEW.replace("Choose explicit requests.", "Changed proposal.");
const SOURCE_CHANGED = "precondition failed: Source changed or moved. Keep the draft and review the new revision before responding.";

boardStory.it(
	"a read-only board refuses to register investigation.model's review and writes no response file",
	[aModelReview(false)],
	function* ({ folderEntries, registerQuestion }) {
		const registration = yield* registerQuestion("investigation.model", "review-model");

		yield* outcomes([
			["project files", () => folderEntries("."), ["board.sock", "investigation.md"]],
			["registration", () => Effect.succeed(registration), "forbidden: Start with --responses to explicitly enable local question/response writes."],
		]);
	},
);

boardStory.it("the board refuses an RPC call posted as a plain-text form", [aModelReview()], function* ({ postPlainTextToRpc }) {
	expect(yield* postPlainTextToRpc()).toBe(HttpStatus.fromLiteral("Forbidden"));
});

boardStory.it("the respond page forbids its markup from submitting forms", [aModelReview()], function* ({ respondPageFormPolicy }) {
	expect(yield* respondPageFormPolicy()).toEqual(["form-action 'none'"]);
});

boardStory.it("registering the same review again returns the first registration", [aModelReview()], function* ({ registerQuestion }) {
	const first = yield* registerQuestion("investigation.model", "review-model");

	expect(yield* registerQuestion("investigation.model", "review-model")).toEqual(first);
});

boardStory.it(
	"recording the same reply again returns the first record",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ recordReply }) {
		const first = yield* recordReply();

		expect(yield* recordReply()).toEqual(first);
	},
);

boardStory.it(
	"recording a reply writes only the question and reply records and leaves investigation.md unchanged",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ fileText, folderEntries, recordReply }) {
		yield* recordReply();

		yield* outcomes([
			["response files", () => folderEntries("responses"), [expect.stringMatching(/^question\.[a-f\d]{64}\.md$/u), "response.first.md"]],
			["source", () => fileText("investigation.md"), MODEL_REVIEW],
		]);
	},
);

boardStory.it(
	"a reply that reuses a recorded reply's identity with other text is refused",
	[
		aModelReview(),
		questionRegistered("investigation.model", "review-model"),
		replyRecorded({ body: "Use explicit requests.", id: "response.first" }),
	],
	function* ({ recordReply }) {
		expect(yield* recordReply({ body: "Different intent", id: "response.first" })).toBe(
			"conflict: The response identity already records different content.",
		);
	},
);

boardStory.it(
	"after a restart the board still lists the recorded reply and an agent's wait returns it",
	[
		aModelReview(),
		questionRegistered("investigation.model", "review-model"),
		replyRecorded({ body: "Use explicit requests.", id: "response.first" }),
	],
	function* ({ agentWaits, replyHistory, restart }) {
		yield* restart();

		yield* outcomes([
			["agent's wait", () => agentWaits(), "response.first"],
			["replies", () => replyHistory(), ["response.first"]],
		]);
	},
);

boardStory.it(
	"after investigation.md changes, a new reply to the question registered before is refused while its earlier reply stays listed",
	[
		aModelReview(),
		questionRegistered("investigation.model", "review-model"),
		replyRecorded({ body: "Use explicit requests.", id: "response.first" }),
	],
	function* ({ outsideEditorWrites, recordReply, replyHistory }) {
		yield* outsideEditorWrites("investigation.md", CHANGED_MODEL);

		yield* outcomes([
			["new reply", () => recordReply({ id: "response.second" }), SOURCE_CHANGED],
			["replies", () => replyHistory(), ["response.first"]],
		]);
	},
);

boardStory.it(
	"after investigation.md changes, registering against the revision reviewed earlier is refused",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorWrites, registerWithEarlierRevision }) {
		yield* outsideEditorWrites("investigation.md", CHANGED_MODEL);

		expect(yield* registerWithEarlierRevision()).toBe(
			"precondition failed: Source changed since review. Read it again before registering this question.",
		);
	},
);

boardStory.it(
	"after investigation.md changes, registering the review again opens a question with a new identity",
	[aModelReview()],
	function* ({ outsideEditorWrites, registerQuestion }) {
		const earlier = yield* registerQuestion("investigation.model", "review-model");

		yield* outsideEditorWrites("investigation.md", CHANGED_MODEL);

		expect(yield* registerQuestion("investigation.model", "review-model")).not.toEqual(earlier);
	},
);

boardStory.it(
	"after investigation.md is renamed, a reply to its registered question is refused",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorMoves, recordReply }) {
		yield* outsideEditorMoves("investigation.md", "moved.md");

		expect(yield* recordReply()).toBe(SOURCE_CHANGED);
	},
);

boardStory.it(
	"after investigation.md is deleted, a reply to its registered question is refused",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorRemoves, recordReply }) {
		yield* outsideEditorRemoves("investigation.md");

		expect(yield* recordReply()).toBe("not found: The exact open attention request is missing, ambiguous or unavailable.");
	},
);

boardStory.it(
	"when responses/ links outside the project, registering is refused and nothing is written there",
	[aModelReview(), responsesFolderLinkedOutside()],
	function* ({ outsideFolderEntries, registerQuestion }) {
		const registration = yield* registerQuestion("investigation.model", "review-model");

		yield* outcomes([
			["outside folder", () => outsideFolderEntries(), []],
			["registration", () => Effect.succeed(registration), expect.stringMatching(/^unavailable: /u)],
		]);
	},
);

boardStory.it(
	"an agent waiting for the reply after a clarification receives the next reply",
	[
		aModelReview(),
		questionRegistered("investigation.model", "review-model"),
		replyRecorded({ body: "Which model?", id: "response.first", type: "clarify" }),
	],
	function* ({ agentStartsWaiting, agentWaitOutcome, recordReply }) {
		yield* agentStartsWaiting("response.first");

		yield* recordReply({ body: "No.", id: "response.second" });

		expect(yield* agentWaitOutcome()).toBe("response.second");
	},
);

boardStory.it(
	"an agent waiting without a cursor still receives the first reply after later replies arrive",
	[
		aModelReview(),
		questionRegistered("investigation.model", "review-model"),
		replyRecorded({ body: "Which model?", id: "response.first", type: "clarify" }),
		replyRecorded({ body: "No.", id: "response.second" }),
	],
	function* ({ agentWaits }) {
		expect(yield* agentWaits()).toBe("response.first");
	},
);

boardStory.it(
	"a copy of the question record makes the reply history unknown",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorCopiesQuestionRecord, replyHistory }) {
		expect(yield* replyHistory()).toEqual([]);

		yield* outsideEditorCopiesQuestionRecord("duplicate.md");

		expect(yield* replyHistory()).toBe("conflict: The registered question identity is ambiguous; response history is unknown.");
	},
);

boardStory.it(
	"a reply record that names no question makes the reply history unknown instead of empty",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorWrites, replyHistory }) {
		expect(yield* replyHistory()).toEqual([]);

		yield* outsideEditorWrites(
			"responses/response.broken.md",
			"---\nid: response.broken\nresponse: { type: answer }\n---\nActual feedback with incomplete provenance\n",
		);

		expect(yield* replyHistory()).toBe("unavailable: A response record is malformed; response history cannot be established safely.");
	},
);

boardStory.it(
	"damaged frontmatter in an ordinary project file leaves the reply history readable",
	[aModelReview(), questionRegistered("investigation.model", "review-model")],
	function* ({ outsideEditorWrites, replyHistory }) {
		yield* outsideEditorWrites("unrelated.md", "---\nid: response.broken\nresponse: [broken\n---\nActual human feedback\n");

		expect(yield* replyHistory()).toEqual([]);
	},
);

for (const { damage, source } of [
	{ damage: "unparsable frontmatter", source: "---\nid: response.broken\nresponse: [broken\n---\nActual human feedback\n" },
	{ damage: "unclosed frontmatter", source: "---\nid: response.broken\nActual human feedback\n" },
]) {
	boardStory.it(
		`a record in responses/ with ${damage} makes both the reply history and the next-reply read refuse as malformed`,
		[aModelReview(), questionRegistered("investigation.model", "review-model")],
		function* ({ nextReply, outsideEditorWrites, replyHistory }) {
			yield* outsideEditorWrites("responses/response.broken.md", source);

			yield* outcomes([
				["next reply", () => nextReply(), expect.stringMatching(/^unavailable: .*malformed/u)],
				["replies", () => replyHistory(), expect.stringMatching(/^unavailable: .*malformed/u)],
			]);
		},
	);
}
