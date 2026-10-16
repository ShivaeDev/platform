import { expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import { renderStatus } from "#host/status.ts";
import { codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("live")(
	"an approved criteria edit steers the running daemon turn once across SIGKILL and reaches review",
	function* () {
		const requests: WireRequest[] = [];
		let completed = false;
		let threads = 0;
		const server = yield* codexServer((request) => {
			requests.push(request);
			switch (request.method) {
				case "thread/start":
					threads += 1;
					return { thread: { id: threads === 1 ? "synthetic-session" : "synthetic-reviewer" } };
				case "thread/read":
					return {
						thread: { ...cloudThread().thread, id: Schema.decodeUnknownSync(Schema.Struct({ threadId: Schema.String }))(request.params).threadId },
					};
				case "turn/start":
					return { turn: { id: "synthetic-turn" } };
				case "thread/turns/list":
					return { data: [{ id: "synthetic-turn", items: [], status: completed ? "completed" : "inProgress" }], nextCursor: null };
				case "thread/items/list":
					return { data: [], nextCursor: null };
				case "turn/steer":
					return { turnId: "synthetic-turn" };
				default:
					return {};
			}
		});
		const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
		const original = task("synthetic-work", "approved", "Original scope.").replace(
			"kind: task",
			"kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]",
		);
		const current = original.replace("Original behavior.", "Changed behavior.");
		yield* withHost(
			{ "work.md": original },
			{
				cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: server.endpoint, environmentId: SYNTHETIC_ENVIRONMENT },
				provider: "cloud",
				worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
			},
			(fixture) =>
				daemonStory(fixture, requests, current, () => {
					completed = true;
				}),
		);
	},
	40_000,
);

function daemonStory(fixture: HostFixture, requests: readonly WireRequest[], current: string, markCompleted: () => void) {
	return Effect.gen(function* () {
		const first = yield* hostProcess(fixture.configFile, true);
		yield* first.until(() => Effect.succeed(first.url !== undefined));
		const client = yield* daemonClient(first.url ?? "missing");
		yield* first.until(() =>
			client("fleet.get", { workId: "synthetic-work" }).pipe(
				Effect.map((record) => record.attempts[0]?.status === "running"),
				Effect.catchTag("NotFound", () => Effect.succeed(false)),
			),
		);
		const worker = yield* client("fleet.get", { workId: "synthetic-work" });
		fixture.write("work.md", current);
		yield* first.until(() =>
			client("fleet.get", { workId: "synthetic-work" }).pipe(Effect.map((record) => record.attempts[0]?.briefSteers?.[0]?.steeredAt !== undefined)),
		);
		function steers() {
			return requests.filter((request) => request.method === "turn/steer");
		}
		expect(steers()).toEqual([
			expect.objectContaining({
				params: {
					expectedTurnId: worker.attempts[0]?.receipt?.turnId,
					input: [{ text: expect.stringContaining(`Full new brief:\n\n${current}`), "text_elements": [], type: "text" }],
					threadId: worker.attempts[0]?.receipt?.sessionId,
				},
			}),
		]);
		expect(JSON.stringify(steers()[0]?.params)).toContain("Criterion behavior: Original behavior. -> Changed behavior.");
		expect(renderStatus(yield* client("daemon.status", {}))).toContain("brief edit steered");
		yield* first.kill;
		const restarted = yield* hostProcess(fixture.configFile, true);
		yield* restarted.until(() => Effect.succeed(restarted.url !== undefined));
		const peer = yield* daemonClient(restarted.url ?? "missing");
		const resumed = yield* peer("fleet.reconcile", { workId: "synthetic-work" });
		yield* peer("fleet.reconcile", { workId: "synthetic-work" });
		expect(resumed.boardContext).toBe(current);
		expect(resumed.attempts[0]?.receipt).toEqual(worker.attempts[0]?.receipt);
		expect(steers()).toHaveLength(1);
		yield* restarted.kill;
		markCompleted();
		const reviewing = yield* Fleet.pipe(
			Effect.flatMap((fleet) => fleet.reconcile("synthetic-work")),
			Effect.provide(
				hostLayer(fixture.host, {
					...fixture.parts,
					integrations: engineIntegrations({ noChange: true }, []),
					provider: hostProvider(fixture.host),
				}),
			),
		);
		expect(reviewing.value.stage).toBe("reviewing");
		expect(reviewing.value.attempts.at(-1)?.prompt).toContain(current.trim());
		expect(steers()).toHaveLength(1);
	}).pipe(Effect.scoped);
}
