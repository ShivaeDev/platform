import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionService } from "#session/service.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { receipt } from "#test/session.ts";
import { withCloudMetadata } from "#test/withCloudMetadata.ts";

const input = { cwd: SYNTHETIC_WORKSPACE, operationId: "synthetic-operation", prompt: "Synthetic work" };

for (const threadNamePrefix of [undefined, "Automation: "]) {
	it.live(`names threads with the ${threadNamePrefix === undefined ? "default" : "configured"} prefix after persisting the session`, () =>
		withCloudMetadata({ ...(threadNamePrefix === undefined ? {} : { threadNamePrefix }), projectId: "synthetic-project" }, (requests, persisted) =>
			Effect.gen(function* () {
				const sessions = yield* SessionService;
				expect(yield* sessions.start(input)).toEqual(receipt);
				expect(requests.find((request) => request.method === "thread/name/set")?.params).toEqual({
					name: `${threadNamePrefix ?? "Fleet: "}${receipt.sessionId}`,
					threadId: receipt.sessionId,
				});
				expect(persisted).toEqual([receipt.sessionId, "name requested"]);
				expect(requests.find((request) => request.method === "thread/start")?.params).toMatchObject({ projectId: "synthetic-project" });
				expect(requests.map((request) => request.method).indexOf("thread/name/set")).toBeLessThan(
					requests.map((request) => request.method).indexOf("turn/start"),
				);
				yield* sessions.archive(receipt.sessionId);
				expect(requests.find((request) => request.method === "thread/archive")?.params).toEqual({ threadId: receipt.sessionId });
			}),
		),
	);
}

it.live("retains threads when archiving is turned off in host config", () =>
	withCloudMetadata({ archiveThreads: false }, (requests) =>
		Effect.gen(function* () {
			const sessions = yield* SessionService;
			yield* sessions.start(input);
			yield* sessions.archive(receipt.sessionId);
			expect(requests.map((request) => request.method)).not.toContain("thread/archive");
			expect(requests.find((request) => request.method === "thread/start")?.params).not.toHaveProperty("projectId");
		}),
	),
);

for (const nameFailure of ["rejected", "timeout"] as const) {
	it.live(`starts the turn after naming is ${nameFailure} and warns with the session and cause`, () => {
		const logs = captureLogs();
		return withCloudMetadata({ nameFailure, requestTimeoutMs: 1000 }, (requests, persisted) =>
			Effect.gen(function* () {
				const sessions = yield* SessionService;
				expect(yield* sessions.start(input)).toEqual(receipt);
				expect(persisted).toEqual([receipt.sessionId, "name requested"]);
				expect(requests.filter((request) => request.method === "turn/start")).toHaveLength(1);
				expect(logs.entries.filter((entry) => entry.level === "Warn")).toEqual([
					{
						annotations: { sessionId: receipt.sessionId },
						cause: expect.stringContaining(nameFailure === "rejected" ? "Name rejected" : "Codex request timed out"),
						level: "Warn",
						message: ["Fleet session naming failed; starting the turn"],
					},
				]);
			}),
		).pipe(Effect.provide(logs.layer));
	});
}
