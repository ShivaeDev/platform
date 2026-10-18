import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { WAIT_EXIT, waitFor } from "#host/wait.ts";
import { codexServer } from "#test/codex.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { daemonCli, withReadDaemon } from "#test/readDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("live");

function waitSummary(port: number, workId: string) {
	return waitFor({ intervalMs: 100, port, timeoutMs: 20_000, workId }).pipe(Effect.map(({ code, summary }) => ({ code, stdout: summary })));
}

function cli(port: number, fixture: HostFixture, args: readonly string[]) {
	return Effect.promise(() => cliProcess([...args, "--board", fixture.host.boardDir, "--config", fixture.configFile, "--port", String(port)]));
}

test("CLI status groups all owners and wait names each owner without changing exit codes", function* () {
	yield* withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			const owners = ["maintainer", "orchestrator", "automation"] as const;
			for (const owner of owners) {
				yield* storeState(fixture.host, owner, { ...statusRecord(owner, "needs-human"), attentionOwner: owner, blocker: "Synthetic blocker" });
			}
			const [waits, text, json] = yield* withReadDaemon(
				fixture.host,
				(port) =>
					Effect.all(
						[Effect.forEach(owners, (owner) => waitSummary(port, owner)), cli(port, fixture, ["status"]), cli(port, fixture, ["status", "--json"])],
						{
							concurrency: "unbounded",
						},
					),
				{ parts: fixture.parts },
			);
			expect(waits).toEqual(
				owners.map((owner) => ({ code: WAIT_EXIT.waitingDecision, stdout: `${owner} needs-human (waiting on ${owner}): Synthetic blocker` })),
			);
			expect(text.code).toBe(0);
			for (const owner of owners) {
				expect(text.stdout).toContain(`Waiting on ${owner} (1)\n  ${owner}  needs-human`);
			}
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
		}),
	);
});

test("terminal publication blockers remain grouped by owner with their original wait exit codes", function* () {
	yield* withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			const stages = ["completed", "released"] as const;
			for (const stage of stages) {
				yield* storeState(fixture.host, stage, {
					...statusRecord(stage, stage),
					attentionOwner: "orchestrator",
					blocker: "Synthetic publication blocker",
					outcome: undefined,
				});
			}
			const [waits, status] = yield* withReadDaemon(
				fixture.host,
				(port) =>
					Effect.all([Effect.forEach(stages, (stage) => waitSummary(port, stage)), cli(port, fixture, ["status"])], { concurrency: "unbounded" }),
				{ parts: fixture.parts },
			);
			expect(waits).toEqual(stages.map((stage) => ({ code: WAIT_EXIT[stage], stdout: `${stage} ${stage} (waiting on orchestrator)` })));
			expect(status.code).toBe(0);
			expect(status.stdout).toContain("Waiting on orchestrator (2)");
			expect(status.stdout).toContain("  completed  completed  Synthetic publication blocker");
			expect(status.stdout).toContain("  released  released  Synthetic publication blocker");
		}),
	);
});

test("CLI reassignment publishes a new maintainer question and refreshes the generated Board", function* () {
	const calls: string[] = [];
	const server = yield* codexServer((request) => {
		calls.push(request.method);
		return {};
	});
	yield* withHost({ "one.md": task("one", "approved") }, { local: { endpoint: server.endpoint } }, (fixture) =>
		Effect.gen(function* () {
			execFileSync("git", ["init", "--quiet", "--initial-branch=main", fixture.host.boardDir]);
			yield* dispatchWork(fixture.host, "one", fixture.parts);
			const old = yield* askWorker(fixture.provider).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			const oldSource = readFileSync(join(fixture.host.boardDir, old.published.sourcePath), "utf8");
			expect(oldSource).toContain('"response_from":["orchestrator"]');
			const changed = yield* daemonCli(
				fixture.host,
				["reassign", "one", old.decision.id, "maintainer", "--board", fixture.host.boardDir, "--config", fixture.configFile],
				{ parts: fixture.parts },
			);
			expect(changed).toEqual({ code: 0, stdout: "one needs-human (waiting on maintainer)" });
			const current = yield* Effect.gen(function* () {
				return (yield* (yield* Fleet).get("one")).value;
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			const sourcePath = current.decision?.published?.sourcePath;
			if (sourcePath === undefined) {
				return yield* Effect.die("Missing reassigned source");
			}
			expect(readFileSync(join(fixture.host.boardDir, sourcePath), "utf8")).toContain('"response_from":["maintainer"]');
			expect(readFileSync(join(fixture.host.boardDir, old.published.sourcePath), "utf8")).toBe(oldSource);
			expect(readFileSync(join(fixture.host.boardDir, "fleet/status.md"), "utf8")).toContain("## Waiting on maintainer\n\n### one");
			expect(calls).toEqual([]);
			expect(fixture.provider.launched).toHaveLength(1);
		}),
	);
});
