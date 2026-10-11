import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { WAIT_EXIT } from "#host/wait.ts";
import { codexServer } from "#test/codex.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { storeState, task, waitProcess, withHost } from "#test/fleetHost.ts";
import { statusRecord } from "#test/status.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("CLI status groups all owners and wait names each owner without changing exit codes", function* () {
	yield* withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			for (const owner of ["maintainer", "orchestrator", "automation"] as const) {
				yield* storeState(fixture.host, owner, { ...statusRecord(owner, "needs-human"), attentionOwner: owner, blocker: "Synthetic blocker" });
				expect(yield* Effect.promise(() => waitProcess(fixture.configFile, owner))).toEqual({
					code: WAIT_EXIT.needsHuman,
					stdout: `${owner} needs-human (waiting on ${owner}): Synthetic blocker`,
				});
			}
			const text = yield* Effect.promise(() => cliProcess(["status", "--board", fixture.host.boardDir, "--config", fixture.configFile]));
			expect(text.code).toBe(0);
			for (const owner of ["maintainer", "orchestrator", "automation"]) {
				expect(text.stdout).toContain(`Waiting on ${owner} (1)\n  ${owner}  needs-human`);
			}
			const json = yield* Effect.promise(() => cliProcess(["status", "--json", "--board", fixture.host.boardDir, "--config", fixture.configFile]));
			expect(json.code).toBe(0);
			expect(JSON.parse(json.stdout)).toMatchObject({
				waiting: { automation: [{ workId: "automation" }], maintainer: [{ workId: "maintainer" }], orchestrator: [{ workId: "orchestrator" }] },
			});
			expect(json.stdout).not.toContain("needsHuman");
		}),
	);
}, 30_000);

test("terminal publication blockers remain grouped by owner with their original wait exit codes", function* () {
	yield* withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			for (const stage of ["completed", "released"] as const) {
				yield* storeState(fixture.host, stage, {
					...statusRecord(stage, stage),
					attentionOwner: "orchestrator",
					blocker: "Synthetic publication blocker",
					outcome: undefined,
				});
				expect(yield* Effect.promise(() => waitProcess(fixture.configFile, stage))).toEqual({
					code: WAIT_EXIT[stage],
					stdout: `${stage} ${stage} (waiting on orchestrator)`,
				});
			}
			const status = yield* Effect.promise(() => cliProcess(["status", "--board", fixture.host.boardDir, "--config", fixture.configFile]));
			expect(status.code).toBe(0);
			expect(status.stdout).toContain("Waiting on orchestrator (2)");
			expect(status.stdout).toContain("  completed  completed  Synthetic publication blocker");
			expect(status.stdout).toContain("  released  released  Synthetic publication blocker");
		}),
	);
}, 30_000);

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
			const changed = yield* Effect.promise(() =>
				cliProcess(["reassign", "one", old.decision.id, "maintainer", "--board", fixture.host.boardDir, "--config", fixture.configFile]),
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
			expect(calls).toEqual(["initialize", "initialized"]);
			expect(fixture.provider.launched).toHaveLength(1);
		}),
	);
}, 30_000);
