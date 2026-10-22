import { Effect } from "effect";
import { expect } from "vitest";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { migrationDecision } from "#test/migrationDecision.ts";

const input = { id: "task.one.1", links: [], reason: "Choose the next step", recommendation: "Release" };

boardFolderStory.it(
	"retains an answered, receipted ask and its publication revision after migration",
	[folderContains("withDependency")],
	function* ({ board, files, migrate, openHttp }) {
		const published = yield* board.decision("task.one", input);
		const legacy = migrationDecision(published, files.read(published.sourcePath), true);
		for (const [file, source] of Object.entries(legacy.files)) {
			files.write(file, source);
		}
		yield* migrate();
		const reading = yield* board.readDecision(legacy.decision);
		expect(reading).toMatchObject({
			_tag: "Response",
			response: { id: "answer.migration", response: { answers: [{ selected: ["release"], text: "" }] } },
		});
		expect(yield* board.decision("task.one", { ...input, published: legacy.decision })).toEqual(legacy.decision);
		const { client } = yield* openHttp();
		const inbox = yield* Effect.promise(() => client.run(client.api.inbox.run(undefined)));
		expect([inbox.you.length, inbox.answered.length, inbox.agents.length, inbox.resolved.length]).toEqual([0, 0, 0, 0]);
		expect(files.read(published.sourcePath)).not.toContain('"answer":');
		expect(yield* migrate()).toMatchObject({ fields: 0, files: 0 });
		files.write(published.sourcePath, `${files.read(published.sourcePath)}\nA changed question.\n`);
		expect((yield* board.readDecision(legacy.decision))._tag).toBe("Stale");
	},
);

boardFolderStory.it(
	"acknowledges a migrated selection answer against its original published revision",
	[folderContains("withDependency")],
	function* ({ board, files, migrate, askFiles, openHttp }) {
		const published = yield* board.decision("task.one", input);
		const legacy = migrationDecision(published, files.read(published.sourcePath), false);
		for (const [file, source] of Object.entries(legacy.files)) {
			files.write(file, source);
		}
		yield* migrate();
		const { client } = yield* openHttp();
		const preview = yield* Effect.promise(() =>
			client.run(client.responses.question.run({ item: legacy.decision.itemId, request: legacy.decision.request })),
		);
		expect(preview).toMatchObject({ id: legacy.decision.questionId, reviewedRevision: legacy.decision.revision });
		const captured = files.read(`responses/${legacy.decision.questionId}.md`);
		const registered = yield* Effect.promise(() =>
			client.mutate(
				client.responses.registerQuestion.run({ item: legacy.decision.itemId, request: legacy.decision.request, revision: preview.reviewedRevision }),
			),
		);
		expect(registered.id).toBe(legacy.decision.questionId);
		expect(files.read(`responses/${legacy.decision.questionId}.md`)).toBe(captured);
		yield* board.acknowledgeDecision({ decision: legacy.decision, disposition: "applied", recordedAt: 3000, responseId: "answer.migration" });
		expect(yield* askFiles()).not.toContain(published.sourcePath);
		expect(files.receipts().map((file) => files.read(file))).toEqual([expect.stringContaining('"response":"answer.migration"')]);
	},
);
