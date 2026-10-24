import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { renderStatus } from "#host/renderStatus.ts";
import { taskPrompt } from "#prompt/task.ts";
import { host } from "#test/hostStory.ts";
import { steeredCloud } from "#test/steeredCloud.ts";

host.it(
	"an approved criteria edit steers the running daemon turn once across SIGKILL and reaches review",
	[steeredCloud],
	function* (daemon) {
		const first = yield* daemon.spawnHost();
		yield* first.until(() => Effect.succeed(first.url !== undefined));
		const client = yield* daemon.processClient(first.url);
		yield* first.until(() =>
			client("fleet.get", { workId: "synthetic-work" }).pipe(
				Effect.map((record) => record.attempts[0]?.status === "running"),
				Effect.catchTag("NotFound", () => Effect.succeed(false)),
			),
		);
		const worker = yield* client("fleet.get", { workId: "synthetic-work" });
		daemon.writeBoard("work.md", daemon.revisedCloudBrief());
		yield* first.until(() =>
			client("fleet.get", { workId: "synthetic-work" }).pipe(Effect.map((record) => record.attempts[0]?.briefSteers?.[0]?.steeredAt !== undefined)),
		);
		const brief = "Full new brief:\n\nApproved task:\n\n# synthetic-work\n\nOriginal scope.\n\nAcceptance criteria:\n\n- Changed behavior.";
		expect(daemon.cloudSteers()).toEqual([
			expect.objectContaining({
				params: {
					expectedTurnId: worker.attempts[0]?.receipt?.turnId,
					input: [{ text: expect.stringContaining(brief), "text_elements": [], type: "text" }],
					threadId: worker.attempts[0]?.receipt?.sessionId,
				},
			}),
		]);
		expect(JSON.stringify(daemon.cloudSteers()[0]?.params)).toContain("Criterion behavior: Original behavior. -> Changed behavior.");
		expect(renderStatus(yield* client("daemon.status", {}))).toContain("brief edit steered");
		yield* first.kill;
		const restarted = yield* daemon.spawnHost();
		yield* restarted.until(() => Effect.succeed(restarted.url !== undefined));
		const peer = yield* daemon.processClient(restarted.url);
		const resumed = yield* peer("fleet.reconcile", { workId: "synthetic-work" });
		yield* peer("fleet.reconcile", { workId: "synthetic-work" });
		expect(resumed.boardContext).toBe(daemon.revisedCloudBrief());
		expect(resumed.attempts[0]?.receipt).toEqual(worker.attempts[0]?.receipt);
		expect(daemon.cloudSteers()).toHaveLength(1);
		yield* restarted.kill;
		daemon.completeCloudTurn();
		const reviewing = yield* daemon.cloudReconcile("synthetic-work", true);
		expect(reviewing.value.step).toBe("reviewing");
		expect(reviewing.value.attempts.at(-1)?.prompt).toContain(taskPrompt(daemon.revisedCloudBrief()));
		expect(daemon.cloudSteers()).toHaveLength(1);
	},
	40_000,
);
