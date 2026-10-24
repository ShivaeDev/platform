import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { renderStatus } from "#host/renderStatus.ts";
import { WAIT_EXIT } from "#host/wait.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { scheduledHost } from "#test/scheduledHost.ts";

const files = { "a.md": task("a", "approved"), "b.md": task("b"), "c.md": task("c", "draft") };

host.it(
	"serve launches each approved Board revision once and wait reports the automation blocker",
	[boardWork(files), scheduledHost],
	function* (daemon) {
		const launched = yield* daemon.launched("a");
		yield* Effect.sleep("2500 millis");
		expect(daemon.providerLaunches()).toHaveLength(1);
		expect(daemon.providerPrompts()).toEqual([expect.stringContaining("id: a")]);
		daemon.finishTurn(launched);
		const outcome = yield* daemon.wait("a", 15_000);
		expect(outcome.code).toBe(WAIT_EXIT.waitingDecision);
		expect(outcome.summary).toMatch(/^a waiting \(waiting on automation\): /u);
		yield* daemon.reconcile("a");
		const status = renderStatus(yield* daemon.status());
		expect(status).toContain("Active (0)");
		expect(status).toContain("Waiting on automation (1)\n  a  waiting");
		expect(daemon.readBoard("fleet/status.md")).toContain("## Waiting on automation\n\n### a");
		expect(daemon.readBoard("fleet/status.md")).toContain("Stage: waiting");
		expect(daemon.readBoard("a.md")).toBe(files["a.md"]);
	},
	40_000,
);

host.it(
	"dispatch denies unapproved work and launches the current approved brief",
	[boardWork({ "a.md": task("a", "approved", "First revision."), "b.md": task("b") })],
	function* (daemon) {
		const denied = yield* daemon.approve("b").pipe(Effect.flip);
		expect(denied).toMatchObject({ _tag: "Forbidden", message: 'b needs "fleet: approved" in its Board frontmatter' });
		yield* daemon.admit();
		const first = yield* daemon.get("a");
		expect(first.step).toBe("queued");
		daemon.writeBoard("a.md", task("a", "approved", "Second revision."));
		yield* daemon.admit();
		const refreshed = yield* daemon.get("a");
		expect(refreshed.boardRevision).not.toBe(first.boardRevision);
		expect(refreshed.prompt).toContain("Second revision.");
		expect(refreshed.history ?? []).toEqual([]);
		expect(refreshed.decision).toBeUndefined();
		expect(daemon.providerLaunches()).toHaveLength(0);
		const { value } = yield* daemon.approve("a");
		expect(value.step).toBe("working");
		expect(value.boardRevision).not.toBe(first.boardRevision);
		expect(daemon.providerLaunches()).toHaveLength(1);
		expect(daemon.providerPrompts()).toEqual([expect.stringContaining("Second revision.")]);
	},
);

host.it(
	"cloud workers get the worker prompt and the host launch defaults under a task's fleet-launch",
	[
		boardWork(
			{
				"a.md": "---\nid: a\nkind: task\nfleet: approved\nfleet-launch:\n  model: task-model\n---\n# a\n\nReport the main revision.\n",
				"b.md": "---\nid: b\nkind: task\nfleet: approved\nfleet-launch: fast\n---\n# b\n",
			},
			{
				cloud: { cwd: "/workspace/repository", environmentId: "environment-test" },
				launch: { effort: "high", model: "host-model", serviceTier: "fast" },
				provider: "cloud",
				worker: { branchPrefix: "fleet/", sharedEnvironment: "/workspace/env.sh" },
			},
		),
	],
	function* (daemon) {
		yield* daemon.approve("a");
		expect(daemon.providerCalls().map((call) => call.settings)).toEqual([
			{ effort: "high", model: "task-model", serviceTier: "fast" },
			{ effort: "high", model: "task-model", serviceTier: "fast" },
		]);
		const [prompt] = daemon.providerPrompts();
		expect(prompt).toMatch(/^Approved task:\n\n# a\n/u);
		expect(prompt).toContain("create fleet/a at that revision");
		expect(prompt).toContain("source /workspace/env.sh once and report it");
		expect(prompt).toContain("run `./script/update` with require_escalated");
		expect(prompt).toContain("Report the main revision.");
		expect(yield* daemon.approve("b").pipe(Effect.flip)).toMatchObject({
			message: "b has an invalid fleet-launch; use model, effort and serviceTier strings",
		});
	},
);
