import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

boardFolderStory.it(
	"refuses a text-only approval answer without closing the Fleet question",
	[folderContains("withDependency")],
	function* ({ board, openHttp }) {
		const receipt = yield* board.decision("task.one", {
			code: "approval-required",
			id: "approval",
			links: [],
			reason: "Work is no longer approved",
			recommendation: "Approve the task and continue.",
		});
		const { client } = yield* openHttp();
		const note = "The task is approved again. Keep the scoped checks.";
		const input = {
			answers: [{ prompt: "fleet-action", selected: [], text: note }],
			author: "maintainer",
			body: "",
			id: "response.approval",
			question: receipt.questionId,
			type: "answer" as const,
		};
		const failure = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input)).catch((error: unknown) => error));
		expect(failure).toBeInstanceOf(Conflict);
		expect(failure).toMatchObject({ message: expect.stringContaining("Choose an option") });
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Pending" });
		const saved = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					...input,
					answers: [{ prompt: "fleet-action", selected: ["retry"], text: note }],
				}),
			),
		);
		expect(saved.body).toContain("Keep the scoped checks.");
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: saved });
	},
);
