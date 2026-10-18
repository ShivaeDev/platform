import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { fleetStatus } from "#host/fleetStatus.ts";
import { hostProvider } from "#host/providers.ts";
import { WAIT_EXIT, waitFor } from "#host/wait.ts";
import { codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { dispatchWork } from "#test/dispatchWork.ts";
import { finishWorkers } from "#test/engine.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");
const ItemRequest = Schema.Struct({ turnId: Schema.String });

const continuationStory = Effect.fn("FleetHostTest.continuationStory")(function* () {
	const requests: WireRequest[] = [];
	let firstTurn = "";
	let terminal = false;
	let started = false;
	const backend = yield* codexServer((request) => {
		requests.push(request);
		switch (request.method) {
			case "thread/read":
				return cloudThread();
			case "turn/start":
				started = true;
				return { turn: { id: "continued-turn" } };
			case "thread/turns/list":
				return {
					data: [
						{ id: firstTurn, items: [], status: "completed" },
						...(started ? [{ id: "continued-turn", items: [], status: terminal ? "completed" : "inProgress" }] : []),
					],
					nextCursor: null,
				};
			case "thread/items/list": {
				const text = Schema.decodeUnknownSync(ItemRequest)(request.params).turnId === "continued-turn" ? "Repaired result" : "Original result";
				return { data: [{ item: { id: "final", phase: "final_answer", text, type: "agentMessage" } }], nextCursor: null };
			}
			default:
				return {};
		}
	});
	const authFile = yield* authFolder(syntheticToken("test", FUTURE_EXPIRY));
	yield* withHost(
		{ "one.md": task("one", "approved") },
		{
			cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: backend.endpoint, environmentId: SYNTHETIC_ENVIRONMENT },
			provider: "cloud",
			worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh" },
		},
		(fixture) =>
			Effect.gen(function* () {
				execFileSync("git", ["init", "--quiet", fixture.host.boardDir]);
				const first = yield* dispatchWork(fixture.host, "one", fixture.parts);
				firstTurn = first.value.attempts[0]?.receipt?.turnId ?? "missing";
				finishWorkers(fixture.provider);
				yield* Effect.gen(function* () {
					yield* (yield* Fleet).reconcile("one");
				}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
				const message = "Fix the checks.\nKeep the existing PR.\n";
				const flags = ["--board", fixture.host.boardDir, "--config", fixture.configFile];
				const args = ["continue", "one", ...flags];
				let errors = "";
				function captureError(text: string) {
					errors += text;
				}
				const options = { onError: captureError, stdin: message };
				const run = yield* withReadDaemon(fixture.host, () => Effect.promise(() => cliProcess(args, options)), {
					parts: { ...fixture.parts, provider: hostProvider(fixture.host) },
				});
				expect(run).toEqual({ code: 0, stdout: "one executing" });
				expect(errors).toBe("");
				expect(readFileSync(join(fixture.host.boardDir, "fleet/status.md"), "utf8")).toContain("Stage: executing");
				expect(JSON.parse(readFileSync(join(fixture.host.boardDir, "fleet/health.json"), "utf8"))).toMatchObject({
					running: 1,
					waiting: { automation: 0, maintainer: 0, orchestrator: 0 },
				});
				expect(requests.find((request) => request.method === "turn/start")?.params).toMatchObject({
					input: [{ text: message, type: "text" }],
					threadId: first.value.attempts[0]?.receipt?.sessionId,
				});
				expect(requests.filter((request) => request.method === "turn/start")).toHaveLength(1);
				expect(requests.filter((request) => request.method === "thread/start")).toHaveLength(0);
				const status = yield* fleetStatus(fixture.host).pipe(Effect.provide(hostDatabase(fixture.host, "work-fleet-reader", 1)));
				expect(status.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
				expect(status.active[0]?.sessions[0]?.turnId).toBe("continued-turn");
				expect(yield* withReadDaemon(fixture.host, (port) => waitFor({ intervalMs: 50, port, timeoutMs: 300, workId: "one" }))).toEqual({
					code: WAIT_EXIT.timeout,
					summary: "one still executing: wait timed out",
				});
				terminal = true;
				const completed = yield* Effect.gen(function* () {
					return yield* (yield* Fleet).reconcile("one");
				}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
				expect(completed.value.attempts[0]?.output).toBe("Repaired result");
				expect(completed.value.history?.[0]?.attempts[0]?.output).not.toBe("Repaired result");
				expect((yield* withReadDaemon(fixture.host, (port) => waitFor({ intervalMs: 50, port, timeoutMs: 20_000, workId: "one" }))).code).toBe(
					WAIT_EXIT.waitingDecision,
				);
			}),
	);
});

test("the continue CLI sends its stdin message on the existing Cloud thread and wait follows the new output", () =>
	Effect.scoped(continuationStory()));
