import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import { readOnlySql } from "#host/readOnlySql.ts";
import { fleetStatus } from "#host/status.ts";
import { codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { finishWorkers } from "#test/engine.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);
const ItemRequest = Schema.Struct({ turnId: Schema.String });

const continuationStory = Effect.fn("FleetHostTest.continuationStory")(function* (input: "argument" | "stdin") {
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
				const args = ["continue", "one", ...(input === "argument" ? [message] : []), ...flags];
				let errors = "";
				const run = yield* Effect.promise(() =>
					cliProcess(args, {
						onError: (text) => {
							errors += text;
						},
						stdin: input === "stdin" ? message : "",
					}),
				);
				expect(run).toEqual({ code: 0, stdout: "one executing" });
				expect(errors).toBe("");
				expect(readFileSync(join(fixture.host.boardDir, "fleet/status.md"), "utf8")).toContain("Stage: executing");
				expect(JSON.parse(readFileSync(join(fixture.host.boardDir, "fleet/health.json"), "utf8"))).toMatchObject({ needsHuman: 0, running: 1 });
				expect(requests.find((request) => request.method === "turn/start")?.params).toMatchObject({
					input: [{ text: message, type: "text" }],
					threadId: first.value.attempts[0]?.receipt?.sessionId,
				});
				expect(requests.filter((request) => request.method === "turn/start")).toHaveLength(1);
				expect(requests.filter((request) => request.method === "thread/start")).toHaveLength(0);
				const status = yield* fleetStatus(fixture.host).pipe(Effect.provide(readOnlySql(fixture.host)));
				expect(status.needsHuman).toEqual([]);
				expect(status.active[0]?.sessions[0]?.turnId).toBe("continued-turn");
				const waiting = yield* Effect.promise(() => cliProcess(["wait", "one", ...flags, "--interval", "0.05", "--timeout", "0.3"]));
				expect(waiting.code).toBe(4);
				expect(waiting.stdout).toBe("one still executing: wait timed out");
				terminal = true;
				const completed = yield* Effect.gen(function* () {
					return yield* (yield* Fleet).reconcile("one");
				}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
				expect(completed.value.attempts[0]?.output).toBe("Repaired result");
				expect(completed.value.history?.[0]?.attempts[0]?.output).not.toBe("Repaired result");
				expect((yield* Effect.promise(() => cliProcess(["wait", "one", ...flags]))).code).toBe(2);
			}),
	);
});

for (const input of ["argument", "stdin"] as const) {
	test(
		`the continue CLI sends its ${input} message on the existing Cloud thread and wait follows the new output`,
		() => Effect.scoped(continuationStory(input)),
		30_000,
	);
}
