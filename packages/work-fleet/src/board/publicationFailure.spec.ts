import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { approvedWork, host } from "#test/hostStory.ts";

const decision = { id: "task.one.3", links: [], reason: "Choose the storage", recommendation: "Use PostgreSQL" };
const CONFLICT = "This identity already records different content; no file was replaced.";

boardFolderStory.it(
	"a filesystem publication failure names the underlying operation",
	[folderContains("withDependency")],
	function* ({ board, files }) {
		files.write("responses", "A file occupies the response directory\n");
		const failure = yield* board.decision("task.one", decision).pipe(Effect.flip);
		expect(failure.message).toContain("Fleet decision source could not be recorded on Board");
		expect(failure.message).toContain("ENOTDIR");
		expect(failure.cause).toMatchObject({ _tag: "ServiceUnavailable", cause: { code: "ENOTDIR" } });
	},
);

for (const record of ["source", "question"] as const) {
	boardFolderStory.it(`a conflicting decision ${record} retains Board's rejection`, [folderContains("withDependency")], function* ({ board, files }) {
		const published = yield* board.decision("task.one", decision);
		files.write(record === "source" ? published.sourcePath : `responses/${published.questionId}.md`, "Different content\n");
		const failure = yield* board.decision("task.one", decision).pipe(Effect.flip);
		expect(failure.message).toContain(CONFLICT);
		expect(failure.cause).toMatchObject({ _tag: "Conflict", message: CONFLICT });
	});

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
