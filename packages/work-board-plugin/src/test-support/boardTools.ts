import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Board, item, needsYou, overview } from "#boardTools.ts";
import { isRecord, text } from "#rpc.ts";

const NOW = 1_800_000_000_000;

interface BoardAnswers {
	readonly documents: Map<string, unknown>;
	fleetItems: unknown;
	inbox: unknown;
	readonly overview: { fleet?: unknown; goals?: unknown };
}

function answerTo(answers: BoardAnswers, request: { readonly payload: unknown; readonly tag: string }): unknown {
	switch (request.tag) {
		case "work-board.document":
			return answers.documents.get(text(isRecord(request.payload) ? request.payload.url : undefined) ?? "");
		case "work-board.fleetItems":
			return answers.fleetItems;
		case "work-board.inbox":
			return answers.inbox;
		case "work-board.overview":
			return answers.overview;
		default:
			return undefined;
	}
}

function idOf(row: Readonly<Record<string, unknown>>): unknown {
	return row.id;
}

export const boardTools = storyKit({
	create: () => {
		const answers: BoardAnswers = { documents: new Map(), fleetItems: undefined, inbox: undefined, overview: {} };
		const board: Board = { ask: (requests) => Promise.resolve(requests.map((request) => answerTo(answers, request))), now: NOW };
		return { answers, board };
	},
	name: "read-only Board tools",
	stages: ["answers"],
	verbs: ({ board }, story) => {
		function listed(id: string) {
			return Effect.promise(async () => (await needsYou(board)).you.find((row) => idOf(row) === id));
		}
		return {
			ageOf: (id: string) => {
				story.tell(`read ${id}'s age from needs_you`);
				return listed(id).pipe(Effect.map((row) => (typeof row?.ageMs === "number" ? `${row.ageMs / 1000} seconds` : "no age")));
			},
			askedOf: (id: string) => {
				story.tell(`read what needs_you asks of ${id}`);
				return listed(id).pipe(
					Effect.map((row) => (row === undefined ? "not listed" : { options: row.options, prompts: row.prompts, recommended: row.recommended })),
				);
			},
			authoredOf: (id: string) => {
				story.tell(`read item ${id}'s authored fields`);
				return Effect.promise(async () => {
					const { criteria, openDecisions, owner, status } = await item(board, id);
					return { criteria, openDecisions, owner, status };
				});
			},
			fleetOf: (id: string) => {
				story.tell(`read the Fleet part of item ${id}`);
				return Effect.promise(async () => (await item(board, id)).fleet);
			},
			overviewFleet: () => {
				story.tell("read Fleet from board_overview");
				return Effect.promise(async () => (await overview(board)).fleet);
			},
			overviewGoals: () => {
				story.tell("read the goals from board_overview");
				return Effect.promise(async () => (await overview(board)).goals.goals);
			},
			overviewGoalTotals: () => {
				story.tell("read the goal totals from board_overview");
				return Effect.promise(async () => {
					const { done, total } = (await overview(board)).goals;
					return { done, total };
				});
			},
			overviewNeedsYou: () => {
				story.tell("read Needs you from board_overview");
				return Effect.promise(async () => {
					const { count, you } = (await overview(board)).needsYou;
					return { count, you };
				});
			},
		};
	},
});

export const decisionWaits = boardTools.trait(
	"answers",
	"the inbox lists decision.a, Decide, because Pick one, from decide.md changed 5 seconds ago and linking to its request next",
	(engine) => {
		engine.answers.inbox = {
			complete: true,
			issues: [],
			you: [
				{
					file: "decide.md",
					href: "/_board/item/decision.a/#answer-card-next",
					id: "decision.a",
					modified: NOW - 5000,
					reason: "Pick one",
					title: "Decide",
				},
			],
		};
	},
);

const EARLIER = { id: "earlier", options: [{ label: "Stop" }], prompts: [{ text: "When?" }], recommended: "Stop" };
const FALLBACK = { id: "decision.a", options: [{ label: "Fallback" }], recommended: "Fallback" };

export const nextAmongOtherRequests = boardTools.trait(
	"answers",
	"decide.md asks an earlier request before next, the request its link opens, and lists fallback options of its own",
	(engine) => {
		engine.answers.documents.set("/decide.md", {
			metadata: FALLBACK,
			requests: [EARLIER, { id: "next", options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" }],
		});
	},
);

export const onlyAnEarlierRequest = boardTools.trait(
	"answers",
	"decide.md asks only an earlier request, not the one its link opens, and lists fallback options of its own",
	(engine) => {
		engine.answers.documents.set("/decide.md", { metadata: FALLBACK, requests: [EARLIER] });
	},
);

export function goalsCounted(
	...goals: readonly { readonly counts: Readonly<Record<string, number>>; readonly id: string; readonly title: string }[]
) {
	return boardTools.trait("answers", `the Board counts the tasks of ${goals.map((goal) => goal.id).join(" and ")}`, (engine) => {
		engine.answers.overview.goals = { goals };
	});
}

export function fleetUnavailable(reason: string) {
	return boardTools.trait("answers", `Fleet is unavailable: ${reason}`, (engine) => {
		const fleet = { reason, state: "unavailable" };
		engine.answers.overview.fleet = fleet;
		engine.answers.fleetItems = fleet;
	});
}

export const taskAuthored = boardTools.trait(
	"answers",
	"task.a is owned by codex in draft, with criterion proof, open decision r and closed decision s",
	(engine) => {
		engine.answers.documents.set("/_board/item/task.a/", {
			metadata: { criteria: [{ id: "proof" }], owner: "codex", status: "draft" },
			requests: [
				{ id: "r", open: true },
				{ id: "s", open: false },
			],
		});
	},
);

export function fleetHolds(stage: "waiting" | "done" | "released") {
	const list = stage === "waiting" ? "items" : "completed";
	return boardTools.trait("answers", `Fleet lists task.a at the ${stage} stage among its ${list}`, (engine) => {
		const held = { stage, workId: "task.a" };
		const fleet = { completed: list === "completed" ? [held] : [], items: list === "items" ? [held] : [], state: "ready" };
		engine.answers.overview.fleet = fleet;
		engine.answers.fleetItems = fleet;
	});
}
