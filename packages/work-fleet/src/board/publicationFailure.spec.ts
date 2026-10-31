import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

const decision = { id: "task.one.3", links: [], reason: "Choose the storage", recommendation: "Use PostgreSQL" };
const CONFLICT = "This identity already records different content; no file was replaced.";

boardFolderStory.it(
	"a decision that cannot be written names the Board record and the filesystem error",
	[folderContains("withDependency")],
	function* ({ files, publishDecision }) {
		files.write("responses", "A file occupies the response directory\n");

		const published = yield* refusal(publishDecision(decision));

		expect(published).toMatch(/^Board failure: Fleet decision source could not be recorded on Board.*ENOTDIR/su);
	},
);

for (const record of ["source", "question"] as const) {
	boardFolderStory.it(
		`republishing a decision whose ${record} was changed is refused with Board's conflict`,
		[folderContains("withDependency")],
		function* ({ files, publishDecision }) {
			const published = yield* publishDecision(decision);
			files.write(record === "source" ? published.sourcePath : `responses/${published.questionId}.md`, "Different content\n");

			const republished = yield* refusal(publishDecision(decision));

			expect(republished).toContain(CONFLICT);
		},
	);

	host.it(`CLI status names a decision ${record} publication failure`, [approvedWork(["one"])], function* (daemon) {
		const started = yield* daemon.dispatch("one");
		daemon.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
		const waiting = yield* daemon.reconcile("one");
		const published = waiting.decision?.published;
		if (published === undefined) {
			throw new Error("Expected a published worker question");
		}
		daemon.writeBoard(record === "source" ? published.sourcePath : `responses/${published.questionId}.md`, "Different content\n");
		yield* daemon.cli(["answer", "one", "Use PostgreSQL."], { selection: "port" });
		const failed = yield* daemon.appliedAnswer("one").pipe(Effect.flip);
		expect(failed.message).toContain(CONFLICT);
		const status = yield* daemon.cli(["status"], { selection: "port" });
		expect(status).toMatchObject({ code: 0 });
		expect(status.stdout).toContain(CONFLICT);
		expect(daemon.providerCalls().map((call) => call.call)).toEqual(["session", "turn"]);
	});
}
