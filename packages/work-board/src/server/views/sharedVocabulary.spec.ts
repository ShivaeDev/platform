import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { sharedVocabularyFixture } from "#test/sharedVocabularyFixture.ts";

boardStory.it(
	"uses authored states for task counts and shows each implementing lane's own progress",
	[projectFiles(sharedVocabularyFixture)],
	function* ({ rpc }) {
		const data = yield* rpc((client) => client("work-board.goals", undefined));
		const goal = data.goals.find((entry) => entry.id === "goal");
		expect(goal?.counts).toEqual({ deferred: 1, done: 1, draft: 1, dropped: 1, ready: 1 });
		expect(goal?.lanes).toEqual([
			{ counts: { deferred: 0, done: 1, draft: 1, dropped: 0, ready: 1 }, id: "lane.board", title: "Board lane" },
			{ counts: { deferred: 1, done: 0, draft: 0, dropped: 1, ready: 0 }, id: "lane.fleet", title: "Fleet lane" },
		]);
		const work = yield* rpc((client) => client("work-board.work", { url: "/_board/work" }));
		expect(work.items.find((entry) => entry.id === "task.draft")).toMatchObject({
			fleetApproved: false,
			metadata: { fleet: "manual", owner: "claude", status: "draft" },
		});
		expect(work.items.find((entry) => entry.id === "task.ready")).toMatchObject({
			fleetApproved: true,
			metadata: { delivers: "pr", owner: "codex", status: "ready" },
		});
		expect(work.items.find((entry) => entry.id === "task.done")).toMatchObject({
			fleetApproved: false,
			metadata: { delivers: "report", fleet: "held", status: "done" },
		});
		const library = yield* rpc((client) => client("work-board.library", { showFleet: true }));
		expect(library.kinds).toEqual(["goal", "question", "report", "task"]);
	},
);

boardStory.it(
	"sorts blocking questions first, shows standing rulings and keeps recorded answers on their question",
	[projectFiles(sharedVocabularyFixture), responsesEnabled()],
	function* ({ rpc }) {
		const inbox = yield* rpc((client) => client("work-board.inbox", undefined));
		expect(inbox.you.map((entry) => ({ id: entry.id, scope: entry.scope, urgency: entry.urgency }))).toEqual([
			{ id: "question.z", scope: "task", urgency: "blocking" },
			{ id: "question.a", scope: "area", urgency: "whenever" },
		]);
		const task = yield* rpc((client) => client("work-board.document", { url: "/ready.md" }));
		expect(task.rulings).toEqual([{ answer: "# Engine ruling\n\nUse the existing engine.\n", href: "/ruling.md", title: "Engine ruling" }]);
		const question = yield* rpc((client) => client("work-board-responses.question", { item: "question.z", request: "answer" }));
		yield* rpc((client) =>
			client("work-board-responses.answerQuestion", {
				author: "marvin",
				body: "Keep the engine",
				id: "answer.blocking",
				item: "question.z",
				request: "answer",
				revision: question.reviewedRevision,
				type: "answer",
			}),
		);
		const answered = yield* rpc((client) => client("work-board.document", { url: "/blocking.md" }));
		expect(answered.requests[0]?.responses?.map((record) => record.body)).toEqual(["Keep the engine"]);
		const library = yield* rpc((client) => client("work-board.library", { showFleet: true }));
		expect(library.files.some((entry) => entry.path.endsWith("answer.blocking.md"))).toBe(false);
	},
);
