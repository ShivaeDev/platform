import { expect } from "@effect/vitest";
import { host } from "#test/hostStory.ts";
import { namedCloud } from "#test/namedCloud.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";

for (const prefix of [undefined, "Automation: "]) {
	host.it(
		`names dispatched workers with the ${prefix === undefined ? "default" : "configured"} prefix and Board title`,
		[namedCloud(prefix)],
		function* (daemon) {
			yield* daemon.approve("synthetic-work");
			expect(daemon.names()).toEqual([`${prefix ?? "Fleet: "}synthetic-work: Readable title`]);
		},
	);
}
for (const role of ["reviewer", "repair"] as const) {
	host.it(`names a separate ${role} thread from its persisted intent before starting its turn`, [namedCloud()], function* (daemon) {
		const attempt = namedAttempt(role);
		yield* daemon.storeNamingRecord(namedRecord("synthetic-work", [attempt], `# ${"x".repeat(90)}`));
		yield* daemon.startNamedSession(attempt.operationId, "Synthetic turn");
		expect(daemon.names()).toEqual([`Fleet: synthetic-work (${role === "reviewer" ? "review" : "repair"}): ${"x".repeat(79)}…`]);
		expect(
			daemon
				.namingRequests()
				.map(({ method }) => method)
				.indexOf("thread/name/set"),
		).toBeLessThan(
			daemon
				.namingRequests()
				.map(({ method }) => method)
				.indexOf("turn/start"),
		);
	});
}
host.it("keeps the worker name when repair continues its existing Cloud thread", [namedCloud()], function* (daemon) {
	const worker = namedAttempt("worker");
	yield* daemon.storeNamingRecord(namedRecord("synthetic-work", [worker]));
	const receipt = yield* daemon.startNamedSession(worker.operationId, "Synthetic work");
	const repair = namedAttempt("repair", receipt.sessionId);
	yield* daemon.storeNamingRecord(namedRecord("synthetic-work", [{ ...worker, receipt, status: "completed" }, repair]));
	yield* daemon.continueNamedSession(repair.operationId, "Synthetic repair", receipt.sessionId);
	expect(daemon.names()).toEqual(["Fleet: synthetic-work: Readable title"]);
	expect(daemon.namingRequests().filter(({ method }) => method === "thread/name/set")).toMatchObject([
		{ params: { name: "Fleet: synthetic-work: Readable title", threadId: receipt.sessionId } },
	]);
	expect(daemon.namingRequests().filter(({ method }) => method === "turn/start")).toMatchObject([
		{ params: { input: [{ text: "Synthetic work" }], threadId: receipt.sessionId } },
		{ params: { input: [{ text: "Synthetic repair" }], threadId: receipt.sessionId } },
	]);
});
host.it(
	"backfills sessions across all records and history once, including legacy names and continued repairs",
	[namedCloud("Automation: ")],
	function* (daemon) {
		const worker = namedAttempt("worker", "synthetic-worker");
		const repair = { ...namedAttempt("repair", "synthetic-worker"), operationId: "synthetic-continuation" };
		const record = namedRecord("synthetic-work", [worker, repair, namedAttempt("reviewer", "synthetic-reviewer")]);
		const old = namedRecord("synthetic-work", [namedAttempt("repair", "synthetic-old")], "# Original title");
		yield* daemon.storeNamingRecord({ ...record, history: [{ ...old, archivedAt: 1 }] });
		yield* daemon.storeNamingRecord(namedRecord("synthetic-other", [namedAttempt("worker", "synthetic-other-session")]));
		yield* daemon.storeNamingRecord(namedRecord("synthetic-prepared", []));
		daemon.setThreadName("synthetic-worker", "New chat");
		daemon.setThreadName("synthetic-reviewer", "Fleet: synthetic-reviewer");
		const args = ["name-threads", "--config", "unused.json"];
		const first = yield* daemon.cli(args, { selection: "port" });
		expect(first.code).toBe(0);
		expect(first.stdout).toContain("synthetic-worker: renamed to Automation: synthetic-work: Readable title");
		expect(first.stdout).toContain("synthetic-reviewer: renamed to Automation: synthetic-work (review): Readable title");
		expect(first.stdout).toContain("synthetic-old: renamed to Automation: synthetic-work (repair): Original title");
		expect(first.stdout).toContain("synthetic-other-session: renamed to Automation: synthetic-other: Readable title");
		expect(daemon.nameChanges().sort((left, right) => left.threadId.localeCompare(right.threadId))).toEqual(
			[
				{ name: "Automation: synthetic-work: Readable title", threadId: "synthetic-worker" },
				{ name: "Automation: synthetic-work (review): Readable title", threadId: "synthetic-reviewer" },
				{ name: "Automation: synthetic-work (repair): Original title", threadId: "synthetic-old" },
				{ name: "Automation: synthetic-other: Readable title", threadId: "synthetic-other-session" },
			].sort((left, right) => left.threadId.localeCompare(right.threadId)),
		);
		expect(yield* daemon.cli(args, { selection: "port" })).toEqual({ code: 0, stderr: "", stdout: "" });
		expect(daemon.nameChanges().sort((left, right) => left.threadId.localeCompare(right.threadId))).toEqual(
			[
				{ name: "Automation: synthetic-work: Readable title", threadId: "synthetic-worker" },
				{ name: "Automation: synthetic-work (review): Readable title", threadId: "synthetic-reviewer" },
				{ name: "Automation: synthetic-work (repair): Original title", threadId: "synthetic-old" },
				{ name: "Automation: synthetic-other: Readable title", threadId: "synthetic-other-session" },
			].sort((left, right) => left.threadId.localeCompare(right.threadId)),
		);
		expect(daemon.namingRequests().filter(({ method }) => method === "thread/start" || method === "turn/start")).toEqual([]);
	},
	30_000,
);
host.it(
	"reports read and rename failures, continues other sessions, and retries only failed names",
	[namedCloud()],
	function* (daemon) {
		yield* daemon.storeNamingRecord(
			namedRecord("synthetic-work", [
				namedAttempt("worker", "synthetic-read-failure"),
				namedAttempt("reviewer", "synthetic-name-failure"),
				namedAttempt("repair", "synthetic-success"),
			]),
		);
		daemon.failNaming("thread/read", "synthetic-read-failure");
		daemon.failNaming("thread/name/set", "synthetic-name-failure");
		const args = ["name-threads", "--config", "unused.json"];
		const first = yield* daemon.cli(args, { selection: "port" });
		expect(first.code).toBe(0);
		expect(first.stderr).toContain("synthetic-read-failure: naming failed: Codex rejected the protocol request: Synthetic naming failure");
		expect(first.stderr).toContain("synthetic-name-failure: naming failed: Codex rejected the protocol request: Synthetic naming failure");
		expect(first.stdout).toContain("synthetic-success: renamed to Fleet: synthetic-work (repair): Readable title");
		daemon.allowNaming();
		const retried = yield* daemon.cli(args, { selection: "port" });
		expect(retried.code).toBe(0);
		expect(retried.stdout).toContain("synthetic-read-failure: renamed to Fleet: synthetic-work: Readable title");
		expect(retried.stdout).toContain("synthetic-name-failure: renamed to Fleet: synthetic-work (review): Readable title");
		expect(retried.stdout).not.toContain("synthetic-success");
		expect(yield* daemon.cli(args, { selection: "port" })).toEqual({ code: 0, stderr: "", stdout: "" });
	},
	30_000,
);
