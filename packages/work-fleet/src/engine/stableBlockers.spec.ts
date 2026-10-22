import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CommittedSink } from "@shivaedev/effect-sql/transact.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, markdownWork } from "#test/engineTraits.ts";
import { HEAD, MOVED, REPORT } from "#test/githubResult.ts";

for (const cleared of ["head", "brief"]) {
	isolatedEngine.it(
		`a changed brief and moved PR head stay quiet until the ${cleared} blocker clears`,
		[githubPullRequest({}), markdownWork()],
		function* ({
			fleet,
			prepareWork,
			workerReports,
			finishWorkers,
			boardBrief,
			writeBoardWork,
			movePullRequestHead,
			schedule,
			advanceTime,
			restart,
			readBoardPublication,
			boardDecisionFiles,
			status,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			finishWorkers();
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
			const original = boardBrief();
			writeBoardWork("one.md", `${original}\nChanged scope.\n`);
			movePullRequestHead(MOVED);
			yield* schedule();
			const blocked = yield* fleet.get("one");
			expect(blocked.value).toMatchObject({
				attentionOwner: "orchestrator",
				decision: { code: "fleet-stale", reason: "Board context changed" },
				step: "waiting",
			});
			expect(blocked.value.blocker).toContain("Board context changed");
			expect(blocked.value.blocker).toContain("PR head differs from the reviewed head");
			const publication = blocked.value.decision?.published;
			if (publication === undefined) {
				throw new Error("Missing blocker publication");
			}
			expect(readBoardPublication(publication.sourcePath).fields.attention).toMatchObject([{ responseFrom: ["orchestrator"], state: "open" }]);
			const summary = yield* status();
			expect(summary).toContain("Board context changed");
			expect(summary).toContain("PR head differs from the reviewed head");
			const publications = boardDecisionFiles();
			expect(publications).toContain(publication.sourcePath.replace("responses/", ""));
			const commits: (readonly unknown[])[] = [];
			const observe = CommittedSink.of((keys) =>
				Effect.sync(() => {
					commits.push(keys);
				}),
			);
			for (let pass = 0; pass < 3; pass += 1) {
				advanceTime(180_000);
				yield* restart();
				yield* schedule().pipe(Effect.provideService(CommittedSink, observe));
				expect(yield* fleet.get("one")).toEqual(blocked);
				expect(boardDecisionFiles()).toEqual(publications);
			}
			expect(commits).toEqual([]);
			if (cleared === "head") {
				movePullRequestHead(HEAD);
			} else {
				writeBoardWork("one.md", original);
			}
			yield* schedule().pipe(Effect.provideService(CommittedSink, observe));
			const changed = yield* fleet.get("one");
			expect(changed.version).toBeGreaterThan(blocked.version);
			expect(changed.value.decision?.reason).toContain(cleared === "head" ? "Board context changed" : "PR head differs from the reviewed head");
			expect(commits.length).toBeGreaterThan(0);
			const remaining = yield* status();
			expect(remaining).not.toContain(cleared === "head" ? "PR head differs from the reviewed head" : "Board context changed");
			commits.length = 0;
			yield* schedule().pipe(Effect.provideService(CommittedSink, observe));
			expect(yield* fleet.get("one")).toEqual(changed);
			expect(commits).toEqual([]);
		},
	);
}
