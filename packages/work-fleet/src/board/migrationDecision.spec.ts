import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { MIGRATED } from "#test/boardDecisionVerbs.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

boardFolderStory.it(
	"a migrated, receipted legacy decision keeps its release answer and its published revision",
	[folderContains("withDependency")],
	function* ({ decisionState, migrateLegacyDecision, publishDecision }) {
		const legacy = yield* migrateLegacyDecision("receipted");

		yield* outcomes([
			["decision", () => decisionState(legacy), "answered by answer.migration"],
			["republished decision", () => publishDecision({ ...MIGRATED, published: legacy }), legacy],
		]);
	},
);

boardFolderStory.it(
	"a migrated, receipted legacy decision leaves every inbox lane empty",
	[folderContains("withDependency")],
	function* ({ inboxLanes, migrateLegacyDecision }) {
		yield* migrateLegacyDecision("receipted");

		expect(yield* inboxLanes()).toEqual({ agents: 0, answered: 0, resolved: 0, you: 0 });
	},
);

boardFolderStory.it(
	"migration moves the legacy answer out of the decision source and a second migration changes nothing",
	[folderContains("withDependency")],
	function* ({ migrate, migrateLegacyDecision, sourceOf }) {
		const legacy = yield* migrateLegacyDecision("receipted");

		yield* outcomes([
			["decision source", () => sourceOf(legacy.sourcePath), expect.not.stringContaining('"answer":')],
			["second migration", () => migrate(), { fields: 0, files: 0 }],
		]);
	},
);

boardFolderStory.it(
	"closing finished decisions closes a migrated receipted decision as done",
	[folderContains("withDependency")],
	function* ({ closeFinishedDecisions, migrateLegacyDecision, sourceOf }) {
		const legacy = yield* migrateLegacyDecision("receipted");

		const closed = yield* closeFinishedDecisions();

		expect(closed).toMatchObject([{ sourcePath: legacy.sourcePath, workId: "task.one" }]);
		expect(metadataParse(yield* sourceOf(legacy.sourcePath)).fields).toMatchObject({ attention: [{ state: "closed" }], status: "done" });
	},
);

boardFolderStory.it(
	"an edited closed decision reads as stale",
	[folderContains("withDependency")],
	function* ({ closeFinishedDecisions, decisionState, files, migrateLegacyDecision }) {
		const legacy = yield* migrateLegacyDecision("receipted");
		yield* closeFinishedDecisions();

		files.write(legacy.sourcePath, `${files.read(legacy.sourcePath)}\nA changed question.\n`);

		expect(yield* decisionState(legacy)).toBe("stale");
	},
);

boardFolderStory.it(
	"a migrated, unreceipted decision previews and registers its original question without rewriting it",
	[folderContains("withDependency")],
	function* ({ migrateLegacyDecision, questionPreview, registerQuestion, sourceOf }) {
		const legacy = yield* migrateLegacyDecision("unreceipted");
		const question = yield* sourceOf(`responses/${legacy.questionId}.md`);

		const registered = yield* registerQuestion(legacy);

		expect(registered).toBe(legacy.questionId);
		yield* outcomes([
			["preview", () => questionPreview(legacy), { question: legacy.questionId, revision: legacy.revision }],
			["question file", () => sourceOf(`responses/${legacy.questionId}.md`), question],
		]);
	},
);

boardFolderStory.it(
	"applying a migrated selection answer takes the decision out of the inbox and records its receipt",
	[folderContains("withDependency")],
	function* ({ acknowledge, inbox, migrateLegacyDecision, receiptRecords }) {
		const legacy = yield* migrateLegacyDecision("unreceipted");
		expect(yield* inbox(legacy)).toBe("asked in the inbox");

		yield* acknowledge(legacy, "applied", "answer.migration");

		yield* outcomes([
			["inbox", () => inbox(legacy), "not in the inbox"],
			["receipts", () => receiptRecords(), [{ disposition: "applied", response: "answer.migration" }]],
		]);
	},
);
