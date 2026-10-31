import { expect } from "@effect/vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { approvedWork, host, storedWork } from "#test/hostStory.ts";
import { WAIT_EXIT } from "./waitOutcome.ts";

const owners = ["maintainer", "orchestrator", "automation"] as const;
const stages = ["done", "released"] as const;

host.it(
	"CLI status groups all owners and wait names each owner without changing exit codes",
	owners.map((owner) => storedWork(owner, "waiting", { attentionOwner: owner, blocker: "Synthetic blocker" })),
	function* (daemon) {
		for (const owner of owners) {
			expect(yield* daemon.wait(owner)).toEqual({
				code: WAIT_EXIT.waitingDecision,
				summary: `${owner} waiting (waiting on ${owner === "maintainer" ? "you" : owner}): Synthetic blocker`,
			});
		}
		const text = yield* daemon.cli(["status"]);
		expect(text.code).toBe(0);
		for (const owner of owners) {
			expect(text.stdout).toContain(`Waiting on ${owner === "maintainer" ? "you" : owner} (1)\n  ${owner}  waiting`);
		}
		const json = yield* daemon.cli(["status", "--json"]);
		expect(json.code).toBe(0);
		expect(Object.keys(JSON.parse(json.stdout)).sort((left, right) => left.localeCompare(right))).toEqual([
			"active",
			"completed",
			"config",
			"waiting",
		]);
		expect(JSON.parse(json.stdout)).toMatchObject({
			waiting: { automation: [{ workId: "automation" }], maintainer: [{ workId: "maintainer" }], orchestrator: [{ workId: "orchestrator" }] },
		});
	},
);

host.it(
	"terminal publication blockers remain grouped by owner with their original wait exit codes",
	stages.map((step) => storedWork(step, step, { attentionOwner: "orchestrator", blocker: "Synthetic publication blocker", outcome: undefined })),
	function* (daemon) {
		for (const step of stages) {
			expect(yield* daemon.wait(step)).toEqual({
				code: WAIT_EXIT[step === "done" ? "completed" : step],
				summary: `${step} ${step} (waiting on orchestrator)`,
			});
		}
		const status = yield* daemon.cli(["status"]);
		expect(status.code).toBe(0);
		expect(status.stdout).toContain("Waiting on orchestrator (2)");
		expect(status.stdout).toContain("  done  done  Synthetic publication blocker");
		expect(status.stdout).toContain("  released  released  Synthetic publication blocker");
	},
);

host.it("CLI reassignment publishes a new maintainer question and refreshes the generated Board", [approvedWork(["one"])], function* (daemon) {
	daemon.initializeRepository();
	yield* daemon.dispatch("one");
	const old = yield* daemon.workerQuestion();
	const oldSource = daemon.readBoard(old.published.sourcePath);
	expect(oldSource).toContain('"response_from":["orchestrator"]');
	const changed = yield* daemon.cli(["reassign", "one", old.decision.id, "maintainer"]);
	expect(changed).toEqual({ code: 0, stderr: "", stdout: "one waiting (waiting on you): Which storage should I use? Choose PostgreSQL or SQLite." });
	const current = yield* daemon.get("one");
	const sourcePath = current.decision?.published?.sourcePath;
	if (sourcePath === undefined) {
		throw new Error("Missing reassigned source");
	}
	expect(daemon.readBoard(sourcePath)).toContain('"response_from":["maintainer"]');
	const closed = board.metadataParse(daemon.readBoard(old.published.sourcePath));
	expect(closed.fields.attention).toMatchObject([{ state: "closed" }]);
	expect(closed.body).toBe(board.metadataParse(oldSource).body);
	const group = "## Waiting on you\n\n### one";
	const published = yield* daemon.awaitBoardSource("fleet/status.md", (source) => source.includes(group));
	expect(published).toContain(group);
	expect(daemon.providerLaunches()).toEqual([(yield* daemon.get("one")).attempts[0]?.operationId]);
});
