import { expect } from "@effect/vitest";
import { SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { cloudMetadata, providerSessions } from "#test/providerSessionStory.ts";
import { receipt } from "#test/session.ts";

const input = { cwd: SYNTHETIC_WORKSPACE, operationId: "synthetic-operation", prompt: "Synthetic work" };

for (const threadNamePrefix of [undefined, "Automation: "]) {
	providerSessions.it(
		`names threads with the ${threadNamePrefix === undefined ? "default" : "configured"} prefix after persisting the session`,
		[cloudMetadata({ ...(threadNamePrefix === undefined ? {} : { threadNamePrefix }), projectId: "synthetic-project" })],
		function* ({ sessions, requests, persisted }) {
			expect(yield* sessions.start(input)).toEqual(receipt);
			expect(requests().find((request) => request.method === "thread/name/set")?.params).toEqual({
				name: `${threadNamePrefix ?? "Fleet: "}synthetic-work: Synthetic work`,
				threadId: receipt.sessionId,
			});
			expect(persisted()).toEqual([receipt.sessionId, "name requested"]);
			expect(requests().find((request) => request.method === "thread/start")?.params).toMatchObject({ projectId: "synthetic-project" });
			expect(
				requests()
					.map((request) => request.method)
					.indexOf("thread/name/set"),
			).toBeLessThan(
				requests()
					.map((request) => request.method)
					.indexOf("turn/start"),
			);
			yield* sessions.archive(receipt.sessionId);
			expect(requests().find((request) => request.method === "thread/archive")?.params).toEqual({ threadId: receipt.sessionId });
		},
	);
}

providerSessions.it(
	"retains threads when archiving is turned off in host config",
	[cloudMetadata({ archiveThreads: false })],
	function* ({ sessions, requests }) {
		yield* sessions.start(input);
		yield* sessions.archive(receipt.sessionId);
		expect(requests().map((request) => request.method)).not.toContain("thread/archive");
		expect(requests().find((request) => request.method === "thread/start")?.params).not.toHaveProperty("projectId");
	},
);

for (const nameFailure of ["rejected", "timeout"] as const) {
	providerSessions.it(
		`starts the turn after naming is ${nameFailure} and warns with the session and cause`,
		[cloudMetadata({ nameFailure, requestTimeoutMs: 1000 })],
		function* ({ sessions, requests, persisted, logs }) {
			expect(yield* sessions.start(input)).toEqual(receipt);
			expect(persisted()).toEqual([receipt.sessionId, "name requested"]);
			expect(requests().filter((request) => request.method === "turn/start")).toMatchObject([
				{ method: "turn/start", params: { threadId: receipt.sessionId } },
			]);
			expect(logs().filter((entry) => entry.level === "Warn")).toEqual([
				{
					annotations: { sessionId: receipt.sessionId },
					cause: expect.stringContaining(nameFailure === "rejected" ? "Name rejected" : "Codex request timed out"),
					level: "Warn",
					message: ["Fleet session naming failed; starting the turn"],
				},
			]);
		},
	);
}
