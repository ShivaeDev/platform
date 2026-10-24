import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { renderStatus } from "#host/renderStatus.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { scheduledHost } from "#test/scheduledHost.ts";

host.it(
	"lowering concurrency in the file stops new launches while running work continues",
	[boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, { concurrency: 3 }), scheduledHost],
	function* (daemon) {
		const one = yield* daemon.launched("one");
		const two = yield* daemon.launched("two");
		yield* daemon.edit({ concurrency: 2 });
		const loaded = yield* daemon.waitForConfig((config) => config.settings.concurrency === 2);
		expect(loaded.restartRequired).toEqual([]);
		daemon.writeBoard("three.md", task("three", "approved"));
		yield* daemon.waiting("three");
		yield* Effect.sleep("2500 millis");
		expect((yield* daemon.request("fleet.get", { workId: "three" })).attempts).toEqual([]);
		expect(daemon.providerLaunches()).toEqual([one.attempts[0]?.operationId, two.attempts[0]?.operationId]);
		for (const running of [one, two]) {
			const current = yield* daemon.request("fleet.get", { workId: running.workId });
			expect(current.step).toBe("working");
			expect(current.attempts).toEqual([expect.objectContaining({ operationId: running.attempts[0]?.operationId, status: "running" })]);
		}
	},
);

host.it(
	"raising concurrency resumes launches with the edited launch settings and interval while running turns keep theirs",
	[
		boardWork(
			{ "one.md": task("one", "approved"), "two.md": task("two", "approved") },
			{ concurrency: 1, intervalSeconds: 60, launch: { serviceTier: "flex" } },
		),
		scheduledHost,
	],
	function* (daemon) {
		const one = yield* daemon.launched("one");
		yield* daemon.waiting("two");
		yield* daemon.edit({ concurrency: 2, intervalSeconds: 1, launch: { serviceTier: "fast" } });
		yield* daemon.waitForConfig((config) => config.settings.concurrency === 2);
		const two = yield* daemon.launched("two");
		expect(daemon.sessionSettings(one.attempts[0]?.operationId)).toEqual({ serviceTier: "flex" });
		expect(daemon.sessionSettings(two.attempts[0]?.operationId)).toEqual({ serviceTier: "fast" });
		expect((yield* daemon.request("fleet.get", { workId: "one" })).attempts[0]?.settings).toEqual({ serviceTier: "flex" });
		yield* daemon.edit({ concurrency: 3 });
		yield* daemon.waitForConfig((config) => config.settings.concurrency === 3);
		daemon.writeBoard("three.md", task("three", "approved"));
		yield* daemon.launched("three");
		const status = renderStatus(yield* daemon.request("daemon.status", {}));
		expect(status).toMatch(/Config loaded \d{4}-\d{2}-\d{2}T[\d:.]+Z from .*fleet\.config\.json/u);
		expect(status).toContain("concurrency 3");
		expect(status).toContain("intervalSeconds 1");
		expect(status).toContain('launch {"serviceTier":"fast"}');
	},
);

host.it(
	"an invalid or partly written edit keeps the last good config, logs a typed warning and the next valid edit applies",
	[boardWork({ "one.md": task("one", "approved") }, { concurrency: 3 }), scheduledHost],
	function* (daemon) {
		const one = yield* daemon.launched("one");
		yield* daemon.request("fleet.reconcile", { workId: "one" });
		const initial = yield* daemon.waitForConfig(() => true);
		yield* daemon.editText('{ "provider": "lo');
		const partial = yield* daemon.waitForConfig((config) => config.rejected !== undefined);
		expect(partial.settings.concurrency).toBe(3);
		expect(partial.loadedAt).toBe(initial.loadedAt);
		yield* daemon.edit({ concurrency: 0, provider: "local" });
		const invalid = yield* daemon.waitForConfig((config) => config.rejected?.field === "concurrency");
		expect(invalid.settings.concurrency).toBe(3);
		expect(invalid.rejected?.message).toContain("is invalid");
		const warnings = daemon
			.logs()
			.filter((entry) => entry.level === "Warn")
			.flatMap((entry) => [entry.message].flat());
		expect(warnings).toContainEqual(expect.objectContaining({ _tag: "HostConfigRejected", field: "concurrency" }));
		expect(renderStatus(yield* daemon.request("daemon.status", {}))).toContain("Rejected edit of concurrency, still applying the config above");
		yield* daemon.edit({ concurrency: 4 });
		const applied = yield* daemon.waitForConfig((config) => config.settings.concurrency === 4);
		expect(applied.rejected).toBeUndefined();
		expect(applied.loadedAt).toBeGreaterThan(initial.loadedAt);
		const current = yield* daemon.request("fleet.get", { workId: "one" });
		expect(current.attempts).toEqual([expect.objectContaining({ operationId: one.attempts[0]?.operationId, status: "running" })]);
	},
);

host.it(
	"a provider change is reported as restart-only while the edit's reloadable settings apply",
	[boardWork({}, {}), scheduledHost],
	function* (daemon) {
		yield* daemon.edit({
			cloud: { cwd: "/synthetic/workspace", environmentId: "synthetic-environment" },
			concurrency: 5,
			provider: "cloud",
			worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
		});
		const config = yield* daemon.waitForConfig((current) => current.restartRequired.length > 0);
		expect(config.restartRequired).toEqual(["cloud", "provider", "worker"]);
		expect(config.settings).toMatchObject({ concurrency: 5, provider: "local" });
		expect(config.settings.cloud).toBeUndefined();
		expect(renderStatus(yield* daemon.request("daemon.status", {}))).toContain("Restart to apply: cloud, provider, worker");
	},
);

host.it(
	"an edited guidance path applies to the next launch and a missing guidance file is rejected by field",
	[
		boardWork(
			{ "first.txt": "First synthetic guidance.", "one.md": task("one", "approved"), "second.txt": "Second synthetic guidance." },
			{ worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", workerGuidance: { file: "first.txt" } } },
		),
		scheduledHost,
	],
	function* (daemon) {
		const one = yield* daemon.launched("one");
		expect(one.attempts[0]?.prompt).toContain("First synthetic guidance.");
		const worker = { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh" };
		yield* daemon.edit({ worker: { ...worker, workerGuidance: { file: "missing.txt" } } });
		const rejected = yield* daemon.waitForConfig((config) => config.rejected !== undefined);
		expect(rejected.rejected?.field).toBe("worker.workerGuidance");
		yield* daemon.edit({ worker: { ...worker, workerGuidance: { file: "second.txt" } } });
		yield* daemon.waitForConfig((config) => config.rejected === undefined);
		daemon.writeBoard("two.md", task("two", "approved"));
		const two = yield* daemon.launched("two");
		expect(two.attempts[0]?.prompt).toContain("Second synthetic guidance.");
		expect(two.attempts[0]?.prompt).not.toContain("First synthetic guidance.");
	},
);

host.it("edits saved by replacing the file keep applying", [boardWork({}, { concurrency: 3 }), scheduledHost], function* (daemon) {
	for (const concurrency of [4, 5]) {
		yield* daemon.replace({ concurrency });
		yield* daemon.waitForConfig((config) => config.settings.concurrency === concurrency);
	}
	yield* daemon.edit({ concurrency: 6 });
	yield* daemon.waitForConfig((config) => config.settings.concurrency === 6);
});

host.it(
	"every reloadable setting reaches the policy the engine reads on its next pass",
	[
		boardWork(
			{ "first.txt": "First review guidance.", "second.txt": "Second review guidance." },
			{
				worker: { branchPrefix: "test/", reviewerGuidance: { file: "first.txt" }, sharedEnvironment: "/synthetic/env.sh" },
			},
		),
		scheduledHost,
	],
	function* (daemon) {
		const before = yield* daemon.policy();
		expect(yield* before.readGuidance?.("reviewer") ?? Effect.succeed(undefined)).toBe("First review guidance.");
		expect(before.openPullRequests).toBeUndefined();
		yield* daemon.edit({
			areaMergeWaitMs: 1234,
			backlog: 7,
			openPullRequests: { ease: 2, max: 5 },
			quota: "codex",
			readRetryMs: 2000,
			stallMinutes: 9,
			worker: { branchPrefix: "test/", reviewerGuidance: { file: "second.txt" }, sharedEnvironment: "/synthetic/env.sh" },
		});
		yield* daemon.waitForConfig((config) => config.settings.backlog === 7);
		const after = yield* daemon.policy();
		expect(after).toMatchObject({
			areaMergeWaitMs: 1234,
			deliveryBacklog: 7,
			openPullRequests: { ease: 2, floor: 0, max: 5 },
			readRetryMs: 2000,
			stallMinutes: 9,
		});
		expect(after.refreshQuota).not.toBe(before.refreshQuota);
		expect(yield* after.readGuidance?.("reviewer") ?? Effect.succeed(undefined)).toBe("Second review guidance.");
	},
);
