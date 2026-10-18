import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

const decision = {
	id: "fleet.denied",
	links: ["https://example.test/pr/1"],
	reason: "Delivery authority is denied",
	recommendation: "Update trusted runtime policy, then retry.",
};
boardFolderStory.it(
	"opens an answerable linked Board decision over real HTTP and records a guided response through native RPC",
	[folderContains("withDependency")],
	function* ({ board, root, openHttp, reopenBoard }) {
		const original = readFileSync(join(root, "task.md"), "utf8");
		yield* Effect.gen(function* () {
			const receipt = yield* board.decision("task.one", decision);
			const { client, url } = yield* openHttp();
			const preview = yield* Effect.tryPromise(() => client.run(client.responses.question.run({ item: receipt.itemId, request: receipt.request })));
			expect(preview.id).toBe(receipt.questionId);
			expect(receipt.workSourcePath).toBe("task.md");
			expect(preview.source).toBe(receipt.sourcePath);
			expect(preview.reviewedRevision).toBe(revisionOf(readFileSync(join(root, receipt.sourcePath), "utf8")));
			const page = yield* Effect.tryPromise(() =>
				fetch(`${url}/_board/respond?item=${receipt.itemId}&request=${receipt.request}`, { redirect: "manual" }),
			);
			expect(page.status).toBe(302);
			expect(page.headers.get("location")).toBe(
				`/_board/item/${encodeURIComponent(receipt.itemId)}/#answer-card-${encodeURIComponent(receipt.request)}`,
			);
			const saved = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["retry"], text: "Preserve independent review." }],
						author: "maintainer",
						body: "Policy is now configured. **Keep the scoped checks.**",
						id: "response.retry",
						question: receipt.questionId,
						type: "answer",
					}),
				),
			);
			expect(saved.body).toContain("Keep the scoped checks");
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: saved });
			yield* Effect.gen(function* () {
				const restarted = yield* reopenBoard();
				expect(yield* restarted.decision("task.one", decision)).toEqual(receipt);
				expect(yield* restarted.readDecision(receipt)).toEqual({ _tag: "Response", response: saved });
			});
			expect(readFileSync(join(root, "task.md"), "utf8")).toBe(original);
		});
	},
);
boardFolderStory.it(
	"keeps clarify and not-now explicit and selects the newest answer from the same author",
	[folderContains("withDependency")],
	function* ({ board, openHttp }) {
		yield* Effect.gen(function* () {
			const receipt = yield* board.decision("task.one", decision);
			const { client } = yield* openHttp();
			const clarify = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						author: "maintainer",
						body: "Which exact scope needs authority?",
						id: "response.clarify",
						question: receipt.questionId,
						type: "clarify",
					}),
				),
			);
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: clarify });
			const deferred = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						author: "maintainer",
						body: "Wait for policy review.",
						id: "response.deferred",
						question: receipt.questionId,
						supersedes: clarify.id,
						type: "not_now",
					}),
				),
			);
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: deferred });
			const answer = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
						author: "maintainer",
						body: "Retry.",
						id: "response.answer",
						question: receipt.questionId,
						supersedes: deferred.id,
						type: "answer",
					}),
				),
			);
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: answer });
			const resolved = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
						author: "maintainer",
						body: "Release instead.",
						id: "response.resolved",
						question: receipt.questionId,
						type: "answer",
					}),
				),
			);
			expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: resolved });
		});
	},
);
boardFolderStory.it(
	"qualifies current answers by exact decision source location, context independently of work revision",
	[folderContains("withDependency")],
	function* ({ board, root, files, openHttp }) {
		yield* Effect.gen(function* () {
			const receipt = yield* board.decision("task.one", decision);
			const { client } = yield* openHttp();
			const source = readFileSync(join(root, receipt.sourcePath), "utf8");
			files.write(receipt.sourcePath, `${source}\nChanged context.\n`);
			expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
			const recorded = yield* Effect.result(
				Effect.tryPromise(() =>
					client.mutate(
						client.responses.recordResponse.run({
							author: "maintainer",
							body: "Old context.",
							id: "response.stale",
							question: receipt.questionId,
							type: "clarify",
						}),
					),
				),
			);
			expect(recorded._tag).toBe("Failure");
			files.write(receipt.sourcePath, source);
			files.move(receipt.sourcePath, "moved.md");
			expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
			files.move("moved.md", receipt.sourcePath);
			files.move("task.md", "moved-task.md");
			expect((yield* board.readDecision(receipt))._tag).toBe("Pending");
			files.move("moved-task.md", "task.md");
			files.write("task.md", `${files.read("task.md")}\nChanged work.\n`);
			expect((yield* board.readDecision(receipt))._tag).toBe("Pending");
		});
	},
);
