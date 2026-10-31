import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { refusal } from "#test/refusal.ts";

const DENIED = {
	id: "fleet.denied",
	links: [],
	reason: "Delivery policy denies this scope",
	recommendation: "Configure trusted policy and retry.",
};
const CLARIFY = { body: "What scope is denied?", id: "response.clarify", type: "clarify" } as const;
const RETRY = { body: "Policy configured.", id: "response.retry", selected: ["retry"], type: "answer" } as const;

boardFolderStory.it(
	"applying a clarify response is refused and the decision stays asked in the inbox",
	[folderContains("withDependency")],
	function* ({ acknowledge, inbox, publishDecision, respond }) {
		const denied = yield* publishDecision(DENIED);
		yield* respond(denied, CLARIFY);

		const applied = yield* acknowledge(denied, "applied", CLARIFY.id);

		expect(applied).not.toBe("accepted");
		expect(yield* inbox(denied)).toBe("asked in the inbox");
	},
);

boardFolderStory.it(
	"applying an answer twice records one receipt for the answer and the reviewed revision",
	[folderContains("withDependency")],
	function* ({ acknowledge, publishDecision, receiptRecords, respond }) {
		const denied = yield* publishDecision(DENIED);
		yield* respond(denied, RETRY);

		yield* acknowledge(denied, "applied", RETRY.id);
		yield* acknowledge(denied, "applied", RETRY.id);

		expect(yield* receiptRecords()).toMatchObject([
			{ disposition: "applied", question: denied.questionId, response: RETRY.id, reviewedRevision: denied.revision },
		]);
	},
);

boardFolderStory.it(
	"an applied decision refuses a later superseded acknowledgement",
	[folderContains("withDependency")],
	function* ({ acknowledge, publishDecision, respond }) {
		const denied = yield* publishDecision(DENIED);
		yield* respond(denied, RETRY);
		yield* acknowledge(denied, "applied", RETRY.id);

		expect(yield* acknowledge(denied, "superseded")).not.toBe("accepted");
	},
);

boardFolderStory.it(
	"an applied answer settles the decision as closed and done with its body, out of the inbox and preview",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, inbox, publishDecision, questionPreview, respond, settledDecision }) {
		const denied = yield* publishDecision(DENIED);
		const body = metadataParse(files.read(denied.sourcePath)).body;
		yield* respond(denied, RETRY);
		expect(yield* inbox(denied)).toBe("asked in the inbox");

		yield* acknowledge(denied, "applied", RETRY.id);

		yield* outcomes([
			["settled decision", () => settledDecision(denied), { attention: [{ state: "closed" }], body, status: "done" }],
			["inbox", () => inbox(denied), "not in the inbox"],
			["question preview", () => refusal(questionPreview(denied)), expect.not.stringMatching(/^accepted$/u)],
		]);
	},
);

boardFolderStory.it(
	"a settled decision's source still lists the applied answer",
	[folderContains("withDependency")],
	function* ({ acknowledge, publishDecision, recordedResponses, respond }) {
		const denied = yield* publishDecision(DENIED);
		yield* respond(denied, RETRY);

		yield* acknowledge(denied, "applied", RETRY.id);

		expect(yield* recordedResponses(denied)).toContain(RETRY.id);
	},
);

boardFolderStory.it(
	"a later decision for settled work is asked in the inbox",
	[folderContains("withDependency")],
	function* ({ acknowledge, inbox, publishDecision, respond }) {
		const denied = yield* publishDecision(DENIED);
		yield* respond(denied, RETRY);
		yield* acknowledge(denied, "applied", RETRY.id);

		const next = yield* publishDecision({ ...DENIED, id: "fleet.denied-again" });

		expect(yield* inbox(next)).toBe("asked in the inbox");
	},
);

boardFolderStory.it(
	"a lost decision republished from the original brief after a task edit keeps its receipt and source",
	[folderContains("withDependency")],
	function* ({ board, decisionState, files, publishDecision, sourceOf }) {
		const original = yield* board.get("task.one");
		const lost = yield* publishDecision(DENIED, original);
		const source = files.read(lost.sourcePath);
		files.write("task.md", `${original.context}\nHuman context changed.\n`);

		const recovered = yield* publishDecision(DENIED, original);

		expect(recovered).toEqual(lost);
		yield* outcomes([
			["source", () => sourceOf(recovered.sourcePath), source],
			["decision", () => decisionState(recovered), "pending"],
		]);
	},
);

boardFolderStory.it(
	"a superseded acknowledgement takes the decision out of the inbox without recording an answer",
	[folderContains("withDependency")],
	function* ({ acknowledge, inbox, publishDecision, receiptRecords }) {
		const denied = yield* publishDecision(DENIED);
		expect(yield* inbox(denied)).toBe("asked in the inbox");

		yield* acknowledge(denied, "superseded");

		yield* outcomes([
			["inbox", () => inbox(denied), "not in the inbox"],
			["receipts", () => receiptRecords(), [{ disposition: "superseded" }]],
			["answers in receipts", () => receiptRecords().pipe(Effect.map((receipts) => receipts.map((receipt) => receipt?.response))), [undefined]],
		]);
	},
);

boardFolderStory.it(
	"a decision published against a brief revision that never existed is refused",
	[folderContains("withDependency")],
	function* ({ board, publishDecision }) {
		const original = yield* board.get("task.one");

		const published = yield* refusal(publishDecision(DENIED, { ...original, revision: "wrong-hash" }));

		expect(published).not.toBe("accepted");
	},
);

boardFolderStory.it(
	"acknowledging a decision whose source changed is refused",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, publishDecision }) {
		const denied = yield* publishDecision(DENIED);
		files.write(denied.sourcePath, `${files.read(denied.sourcePath)}\nChanged decision.\n`);

		expect(yield* acknowledge(denied, "superseded")).not.toBe("accepted");
	},
);

boardFolderStory.it(
	"a duplicated receipt keeps the decision asked in the inbox",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, inbox, publishDecision }) {
		const denied = yield* publishDecision(DENIED);
		const source = files.read(denied.sourcePath);
		yield* acknowledge(denied, "superseded");
		expect(yield* inbox(denied)).toBe("not in the inbox");

		files.write(denied.sourcePath, source);
		files.write("responses/duplicate-receipt.md", files.read(files.receipts()[0] ?? ""));

		expect(yield* inbox(denied)).toBe("asked in the inbox");
	},
);

boardFolderStory.it(
	"acknowledging a decision with unsupported metadata is refused",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, publishDecision }) {
		const denied = yield* publishDecision(DENIED);
		files.write(denied.sourcePath, files.read(denied.sourcePath).replace('"managed":true', '"managed":true,"unsupported":true'));

		expect(yield* acknowledge(denied, "superseded")).not.toBe("accepted");
	},
);
