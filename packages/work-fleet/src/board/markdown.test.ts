import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { questionFrom } from "@shivaedev/work-board/server/responses/records.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

boardFolderStory.it(
	"reads stable Board identity and publishes a durable retryable Board decision",
	[folderContains("withDependency")],
	function* ({ board, root }) {
		yield* Effect.gen(function* () {
			const work = yield* board.get("task.one");
			expect(work.dependsOn).toEqual(["task.before"]);
			expect(work.areas).toEqual(["work-fleet/host", "work-board/ui"]);
			expect(work.status).toBe("done");
			expect(work.context).toContain("# Useful work");
			const decision = {
				id: "fleet.denied",
				links: ["https://example.test/pr/1"],
				reason: "Delivery authority is denied",
				recommendation: "Approve exact scope through trusted runtime policy",
			};
			const receipt = yield* board.decision(work.workId, decision);
			expect(yield* board.decision(work.workId, decision)).toEqual(receipt);
			const files = readdirSync(join(root, "responses"));
			expect(files).toHaveLength(2);
			const source = `responses/${receipt.questionId}.md`;
			const parsed = metadataParse(readFileSync(join(root, source), "utf8"));
			const context = readFileSync(join(root, receipt.sourcePath), "utf8");
			expect(context).toContain(':::option{id="retry"}');
			expect(context).toContain(':::option{id="release"}');
			expect(questionFrom({ file: source, parsed })?.question.reason).toContain(decision.reason);
			expect(context).not.toContain(decision.recommendation);
			expect(questionFrom({ file: source, parsed })?.question.item).toBe(receipt.itemId);
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Pending" });
		});
	},
);
boardFolderStory.it(
	"refuses ambiguous IDs and malformed metadata instead of selecting a task",
	[folderContains("ambiguousIdentity")],
	function* ({ board }) {
		const result = yield* Effect.gen(function* () {
			return yield* Effect.exit(board.get("same"));
		});
		expect(Exit.isFailure(result)).toBe(true);
	},
);
