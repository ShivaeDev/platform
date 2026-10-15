import { expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");

for (const field of ["criteria", "body"]) {
	test(`approved ${field} edits to a ready PR resume its worker after restart without another Board request`, () =>
		withFleetBoard({ denyDelivery: true }, (fixture, root, source) =>
			Effect.gen(function* () {
				const files = boardHttpFiles(root);
				const original = source.replace("kind: task", "kind: task\nowner: codex\ncriteria: [{ id: behavior, text: Original behavior. }]");
				files.write("one.md", original);
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ready = yield* fleet.reconcile("one");
				expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const requests = (yield* fs.readDirectory(path.join(root, "responses"))).filter((file) => !file.startsWith("request-receipt."));
				const current = field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`;
				files.write("one.md", current);
				const continued = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
				expect(continued.value.stage).toBe("executing");
				expect(continued.value.boardContext).toBe(current);
				expect(continued.value.boardRevision).toBe(briefRevision(metadataParse(current)));
				expect(continued.value.result).toEqual(ready.value.result);
				expect(continued.value.preparation).toEqual(ready.value.preparation);
				expect(continued.value.attempts.at(-1)).toMatchObject({
					prompt: expect.stringContaining(current),
					receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId },
					role: "repair",
				});
				expect(continued.value.prompt).toContain(`same branch and PR (${ready.value.result?.kind === "change" ? ready.value.result.pr : ""})`);
				expect(continued.value.decision).toBeUndefined();
				expect(continued.value.attentionOwner).toBeUndefined();
				expect(continued.value.blocker).toBeUndefined();
				expect(continued.value.review).toBeUndefined();
				expect(continued.value.checks).toBeUndefined();
				expect(continued.value.mergeReadyAt).toBeUndefined();
				expect(continued.value.mergeReadyHead).toBeUndefined();
				expect(continued.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: ready.value.decision?.published }]);
				expect(files.receipts()).toHaveLength(1);
				expect((yield* fs.readDirectory(path.join(root, "responses"))).filter((file) => !file.startsWith("request-receipt."))).toEqual(requests);
				expect(fixture.launched).toHaveLength(2);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(3);
				const observed = yield* fleet.reconcile("one");
				expect(observed.value.attempts.map((attempt) => attempt.receipt)).toEqual(continued.value.attempts.map((attempt) => attempt.receipt));
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(3);
			}),
		));
}

for (const change of ["unapproved", "owner", "done", "superseded", "deferred"]) {
	test(`${change} edits to a ready brief do not resume its worker`, () =>
		withFleetBoard({ denyDelivery: true }, (fixture, root, source) =>
			Effect.gen(function* () {
				const original = source.replace("kind: task", "kind: task\nowner: codex");
				boardHttpFiles(root).write("one.md", original);
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ready = yield* fleet.reconcile("one");
				const edited = `${original}\nChanged scope.\n`;
				const current = changedReadyBrief(edited, change);
				boardHttpFiles(root).write("one.md", current);
				const held = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
				expect(held.value.stage).toBe(["unapproved", "owner"].includes(change) ? "needs-human" : "released");
				if (held.value.stage === "needs-human") {
					expect(held.value.decision?.reason).toBe("Board context changed");
				}
				expect(held.value.boardContext).toBe(original);
				expect(held.value.attempts.map((attempt) => attempt.receipt)).toEqual(ready.value.attempts.map((attempt) => attempt.receipt));
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
		));
}

function changedReadyBrief(source: string, change: string) {
	if (change === "unapproved") {
		return source.replace("fleet: approved", "fleet: draft");
	}
	if (change === "owner") {
		return source.replace("owner: codex", "owner: maintainer");
	}
	return source.replace("kind: task", `kind: task\nstatus: ${change}`);
}
