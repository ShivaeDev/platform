import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Board, documentAt, item, needsYou, overview } from "#boardTools.ts";

export const NOW = 1_800_000_000_000;

export const boardTools = storyKit({
	create: () => {
		const answers: Record<string, unknown> = {};
		const board: Board = {
			ask: (requests) =>
				Promise.resolve(requests.map((request) => answers[request.tag === "work-board.document" ? JSON.stringify(request.payload) : request.tag])),
			now: NOW,
		};
		return { answers, board };
	},
	name: "read-only Board tools",
	stages: ["answers"],
	verbs: ({ board }, story) => ({
		item: (id: string) =>
			Effect.promise(() => {
				story.tell(`read item ${id}`);
				return item(board, id);
			}),
		needsYou: () =>
			Effect.promise(() => {
				story.tell("read the items that need a decision");
				return needsYou(board);
			}),
		overview: () =>
			Effect.promise(() => {
				story.tell("read the Board overview");
				return overview(board);
			}),
	}),
});

export function boardAnswers(answers: Readonly<Record<string, unknown>>) {
	return boardTools.trait("answers", "the Board answers its read-only queries", (engine) => {
		Object.assign(engine.answers, answers);
	});
}

export function taskInFleet(stage: string) {
	return boardAnswers({
		[JSON.stringify(documentAt("/_board/item/task.a/").payload)]: {
			metadata: { criteria: [{ id: "proof" }], owner: "codex", status: "draft" },
			requests: [{ id: "r", open: true }],
		},
		"work-board.fleetItems": { completed: [], items: [{ stage, workId: "task.a" }], state: "ready" },
	});
}
