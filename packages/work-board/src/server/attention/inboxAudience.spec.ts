import { expect, it } from "vitest";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { inboxItems } from "./inbox.ts";
import { attentionProjection } from "./projection.ts";

it("includes requests naming the maintainer among several responders and unaddressed questions", () => {
	const files = inboxAudienceFixture();
	const snapshot = inboxSnapshot({ ...files, "reader.md": files["reader.md"]?.replace("[maintainer]", "[orchestrator, maintainer]") ?? "" });
	expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
});

it("uses the configured literal responder label", () => {
	const snapshot = inboxSnapshot(inboxAudienceFixture("Casey"));
	expect(inboxItems(snapshot).map((item) => item.id)).toEqual(["question.storage"]);
	expect(inboxItems({ ...snapshot, maintainer: "Casey" }).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	expect(inboxItems({ ...snapshot, maintainer: "casey" }).map((item) => item.id)).toEqual(["question.storage"]);
});

it("does not reintroduce another responder's managed request through identity problems", () => {
	const files = inboxAudienceFixture();
	const duplicate = inboxSnapshot({ ...files, "duplicate.md": files["orchestrator.md"] ?? "" });
	expect(inboxItems(duplicate).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	const missing = inboxSnapshot({ ...files, "orchestrator.md": files["orchestrator.md"]?.replace("id: decision.orchestrator\n", "") ?? "" });
	expect(inboxItems(missing).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
	const readerDuplicate = inboxSnapshot({ ...files, "duplicate.md": files["reader.md"] ?? "" });
	expect(attentionProjection(readerDuplicate).issues.filter((issue) => issue.message.includes("Duplicate"))).toHaveLength(2);
	expect(inboxItems(readerDuplicate).filter((item) => item.id === "decision.reader")).toHaveLength(0);
});

it("filters addressed authored questions before their generic waiting reason", () => {
	const files = Object.fromEntries(
		Object.entries(inboxAudienceFixture()).map(([file, source]) => [file, source.replace("kind: decision\n", "kind: question\n")]),
	);
	expect(inboxItems(inboxSnapshot(files)).map((item) => item.id)).toEqual(["decision.reader", "question.storage"]);
});

it("keeps unaddressed questions with no attention requests", () => {
	const files = inboxAudienceFixture();
	const source = files["unaddressed.md"]?.replace("status: open", "status: open\nattention: []") ?? "";
	expect(inboxItems(inboxSnapshot({ "question.md": source })).map((item) => item.id)).toEqual(["question.storage"]);
});

it("does not reintroduce another responder's question through owner actions or needs-human status", () => {
	const files = inboxAudienceFixture();
	for (const fields of ["owner: orchestrator\nnext_action: Choose a direction", "status: needs-human"]) {
		const source = files["orchestrator.md"]?.replace("kind: decision\n", `kind: decision\n${fields}\n`) ?? "";
		expect(inboxItems(inboxSnapshot({ ...files, "orchestrator.md": source })).map((item) => item.id)).toEqual([
			"decision.reader",
			"question.storage",
		]);
	}
});

it("ignores another responder's closed requests when a person owns the next action", () => {
	const files = inboxAudienceFixture();
	const source =
		files["orchestrator.md"]
			?.replace("kind: decision\n", "kind: decision\nowner: Casey\nnext_action: Choose a direction\n")
			.replace("state: open", "state: closed") ?? "";
	expect(inboxItems(inboxSnapshot({ ...files, "orchestrator.md": source })).map((item) => item.id)).toEqual([
		"decision.orchestrator",
		"decision.reader",
		"question.storage",
	]);
});
