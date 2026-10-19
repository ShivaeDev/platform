import { expect } from "vitest";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { anInbox } from "#test/storyTraits.ts";
import { inboxItems } from "./inbox.ts";
import { attentionProjection } from "./projection.ts";

boardStory.it(
	"includes requests naming the maintainer among several responders and unaddressed questions",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = inboxAudienceFixture();
		const snapshot = yield* readAttention({ ...files, "reader.md": files["reader.md"]?.replace("[maintainer]", "[orchestrator, maintainer]") ?? "" });
		expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	},
);

boardStory.it("uses the configured literal responder label", [deferredServing, anInbox()], function* ({ readAttention }) {
	const snapshot = yield* readAttention(inboxAudienceFixture("Casey"));
	expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["question.storage"]);
	expect(inboxItems({ ...snapshot, maintainer: "Casey" }).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	expect(inboxItems({ ...snapshot, maintainer: "casey" }).map((item) => item.id)).toEqual(["question.storage"]);
});

boardStory.it(
	"does not reintroduce another responder's managed request through identity problems",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = inboxAudienceFixture();
		const duplicate = yield* readAttention({ ...files, "duplicate.md": files["orchestrator.md"] ?? "" });
		expect(inboxItems(duplicate).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
		const missing = yield* readAttention({ ...files, "orchestrator.md": files["orchestrator.md"]?.replace("id: decision.orchestrator\n", "") ?? "" });
		expect(inboxItems(missing).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
		const readerDuplicate = yield* readAttention({ ...files, "duplicate.md": files["reader.md"] ?? "" });
		expect(attentionProjection(readerDuplicate).issues.filter((issue) => issue.message.includes("Duplicate"))).toHaveLength(2);
		expect(inboxItems(readerDuplicate).filter((item) => item.id === "decision.reader")).toHaveLength(0);
	},
);

boardStory.it(
	"filters addressed authored questions before their generic waiting reason",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = Object.fromEntries(
			Object.entries(inboxAudienceFixture()).map(([file, source]) => [file, source.replace("kind: decision\n", "kind: question\n")]),
		);
		expect(inboxItems(yield* readAttention(files)).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	},
);

boardStory.it("keeps unaddressed questions with no attention requests", [deferredServing, anInbox()], function* ({ readAttention }) {
	const files = inboxAudienceFixture();
	const source = files["unaddressed.md"]?.replace("status: open", "status: open\nattention: []") ?? "";
	expect(inboxItems(yield* readAttention({ "question.md": source })).map((item) => item.id)).toEqual(["question.storage"]);
});

boardStory.it(
	"does not reintroduce another responder's question through owner actions or needs-human status",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = inboxAudienceFixture();
		for (const fields of ["owner: orchestrator\nnext_action: Choose a direction", "status: needs-human"]) {
			const source = files["orchestrator.md"]?.replace("kind: decision\n", `kind: decision\n${fields}\n`) ?? "";
			expect(inboxItems(yield* readAttention({ ...files, "orchestrator.md": source })).map((item) => item.id)).toEqual([
				"decision.reader",
				"question.storage",
			]);
		}
	},
);

boardStory.it(
	"ignores another responder's closed requests when a person owns the next action",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = inboxAudienceFixture();
		const source =
			files["orchestrator.md"]
				?.replace("kind: decision\n", "kind: decision\nowner: Casey\nnext_action: Choose a direction\n")
				.replace("state: open", "state: closed") ?? "";
		expect(inboxItems(yield* readAttention({ ...files, "orchestrator.md": source })).map((item) => item.id)).toEqual([
			"decision.orchestrator",
			"decision.reader",
			"question.storage",
		]);
	},
);
