import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { DENIED_DELIVERY } from "#test/boardDecisionVerbs.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { refusal } from "#test/refusal.ts";

const CLARIFY = { body: "What scope is denied?", id: "response.clarify", type: "clarify" } as const;
const RETRY = { body: "Policy configured.", id: "response.retry", selected: ["retry"], type: "answer" } as const;

boardFolderStory.it(
	"applying a clarify response is refused and the decision stays asked in the inbox",
	[folderContains("withDependency")],
	function* ({ acknowledge, inbox, publishDecision, receiptRecords, respond }) {
		const denied = yield* publishDecision(DENIED_DELIVERY);
		yield* respond(denied, CLARIFY);
		expect(yield* inbox(denied)).toBe("asked in the inbox");

		const applied = yield* acknowledge(denied, "applied", CLARIFY.id);

		expect(applied).toBe("stale acknowledgement: The exact managed question and applicable response cannot be qualified for acknowledgement.");
		yield* outcomes([
			["inbox", () => inbox(denied), "asked in the inbox"],
			["receipts", () => receiptRecords(), []],
		]);
	},
);

boardFolderStory.it(
	"an applied decision refuses a later superseded acknowledgement",
	[folderContains("withDependency")],
	function* ({ acknowledge, publishDecision, receiptRecords, respond }) {
		const denied = yield* publishDecision(DENIED_DELIVERY);
		yield* respond(denied, RETRY);
		yield* acknowledge(denied, "applied", RETRY.id);
		const receipts = yield* receiptRecords();

		const refused = yield* acknowledge(denied, "superseded");

		yield* outcomes([
			[
				"acknowledgement",
				() => Effect.succeed(refused),
				"stale acknowledgement: The decision source changed or moved; its request cannot be acknowledged.",
			],
			["receipts", () => receiptRecords(), receipts],
		]);
	},
);

boardFolderStory.it(
	"a decision published against a brief revision that never existed is refused",
	[folderContains("withDependency")],
	function* ({ board, files, publishDecision, receiptRecords }) {
		const original = yield* board.get("task.one");

		const published = yield* refusal(publishDecision(DENIED_DELIVERY, { ...original, revision: "wrong-hash" }));

		expect(published).toBe("Board failure: The original Board publication context does not match its identity, revision or source boundary.");
		expect(files.read("task.md")).toBe(original.context);
		expect(yield* receiptRecords()).toEqual([]);
	},
);

boardFolderStory.it(
	"acknowledging a decision whose source changed is refused",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, publishDecision, receiptRecords, sourceOf }) {
		const denied = yield* publishDecision(DENIED_DELIVERY);
		files.write(denied.sourcePath, `${files.read(denied.sourcePath)}\nChanged decision.\n`);
		const source = files.read(denied.sourcePath);

		expect(yield* acknowledge(denied, "superseded")).toBe(
			"stale acknowledgement: The decision source changed or moved; its request cannot be acknowledged.",
		);
		yield* outcomes([
			["source", () => sourceOf(denied.sourcePath), source],
			["receipts", () => receiptRecords(), []],
		]);
	},
);

boardFolderStory.it(
	"acknowledging a decision with unsupported metadata is refused",
	[folderContains("withDependency")],
	function* ({ acknowledge, files, publishDecision, receiptRecords, sourceOf }) {
		const denied = yield* publishDecision(DENIED_DELIVERY);
		files.write(denied.sourcePath, files.read(denied.sourcePath).replace('"managed":true', '"managed":true,"unsupported":true'));
		const source = files.read(denied.sourcePath);

		expect(yield* acknowledge(denied, "superseded")).toBe(
			"stale acknowledgement: The decision source changed or moved; its request cannot be acknowledged.",
		);
		yield* outcomes([
			["source", () => sourceOf(denied.sourcePath), source],
			["receipts", () => receiptRecords(), []],
		]);
	},
);
