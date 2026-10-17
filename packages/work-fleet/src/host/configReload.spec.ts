import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { renderStatus } from "#host/renderStatus.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { withReloadDaemon } from "#test/configReload.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

function settingsOf(fixture: HostFixture, operationId: string | undefined) {
	return fixture.provider.settings.find((entry) => entry.call === "session" && entry.operationId === operationId)?.settings;
}

test("lowering concurrency in the file stops new launches while running work continues", () =>
	withHost({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, { concurrency: 3 }, (fixture) =>
		withReloadDaemon(fixture, (daemon) =>
			Effect.gen(function* () {
				const one = yield* daemon.launched("one");
				const two = yield* daemon.launched("two");
				yield* daemon.edit({ concurrency: 2 });
				const loaded = yield* daemon.config((config) => config.settings.concurrency === 2);
				expect(loaded.restartRequired).toEqual([]);
				fixture.write("three.md", task("three", "approved"));
				yield* daemon.waiting("three");
				yield* Effect.sleep("2500 millis");
				expect((yield* daemon.client("fleet.get", { workId: "three" })).attempts).toEqual([]);
				expect(fixture.provider.launched).toEqual([one.attempts[0]?.operationId, two.attempts[0]?.operationId]);
				for (const running of [one, two]) {
					const current = yield* daemon.client("fleet.get", { workId: running.workId });
					expect(current.stage).toBe("executing");
					expect(current.attempts).toEqual([expect.objectContaining({ operationId: running.attempts[0]?.operationId, status: "running" })]);
				}
			}),
		),
	));

test("raising concurrency resumes launches with the edited launch settings and interval while running turns keep theirs", () =>
	withHost(
		{ "one.md": task("one", "approved"), "two.md": task("two", "approved") },
		{ concurrency: 1, intervalSeconds: 60, launch: { serviceTier: "flex" } },
		(fixture) =>
			withReloadDaemon(fixture, (daemon) =>
				Effect.gen(function* () {
					const one = yield* daemon.launched("one");
					yield* daemon.waiting("two");
					yield* daemon.edit({ concurrency: 2, intervalSeconds: 1, launch: { serviceTier: "fast" } });
					yield* daemon.config((config) => config.settings.concurrency === 2);
					const two = yield* daemon.launched("two");
					expect(settingsOf(fixture, one.attempts[0]?.operationId)).toEqual({ serviceTier: "flex" });
					expect(settingsOf(fixture, two.attempts[0]?.operationId)).toEqual({ serviceTier: "fast" });
					expect((yield* daemon.client("fleet.get", { workId: "one" })).attempts[0]?.settings).toEqual({ serviceTier: "flex" });
					yield* daemon.edit({ concurrency: 3 });
					yield* daemon.config((config) => config.settings.concurrency === 3);
					fixture.write("three.md", task("three", "approved"));
					yield* daemon.launched("three");
					const status = renderStatus(yield* daemon.client("daemon.status", {}));
					expect(status).toMatch(/Config loaded \d{4}-\d{2}-\d{2}T[\d:.]+Z from .*fleet\.config\.json/u);
					expect(status).toContain("concurrency 3");
					expect(status).toContain("intervalSeconds 1");
					expect(status).toContain('launch {"serviceTier":"fast"}');
				}),
			),
	));

test("an invalid or partly written edit keeps the last good config, logs a typed warning and the next valid edit applies", () => {
	const logs = captureLogs();
	return withHost({ "one.md": task("one", "approved") }, { concurrency: 3 }, (fixture) =>
		withReloadDaemon(fixture, (daemon) =>
			Effect.gen(function* () {
				const one = yield* daemon.launched("one");
				const initial = yield* daemon.config(() => true);
				yield* daemon.editText('{ "provider": "lo');
				const partial = yield* daemon.config((config) => config.rejected !== undefined);
				expect(partial.settings.concurrency).toBe(3);
				expect(partial.loadedAt).toBe(initial.loadedAt);
				yield* daemon.edit({ concurrency: 0, provider: "local" });
				const invalid = yield* daemon.config((config) => config.rejected?.field === "concurrency");
				expect(invalid.settings.concurrency).toBe(3);
				expect(invalid.rejected?.message).toContain("is invalid");
				const warnings = logs.entries.filter((entry) => entry.level === "Warn").flatMap((entry) => [entry.message].flat());
				expect(warnings).toContainEqual(expect.objectContaining({ _tag: "HostConfigRejected", field: "concurrency" }));
				expect(renderStatus(yield* daemon.client("daemon.status", {}))).toContain("Rejected edit of concurrency, still applying the config above");
				yield* daemon.edit({ concurrency: 4 });
				const applied = yield* daemon.config((config) => config.settings.concurrency === 4);
				expect(applied.rejected).toBeUndefined();
				expect(applied.loadedAt).toBeGreaterThan(initial.loadedAt);
				const current = yield* daemon.client("fleet.get", { workId: "one" });
				expect(current.attempts).toEqual([expect.objectContaining({ operationId: one.attempts[0]?.operationId, status: "running" })]);
			}),
		),
	).pipe(Effect.provide(logs.layer));
});

test("a provider change is reported as restart-only while the edit's reloadable settings apply", () =>
	withHost({}, {}, (fixture) =>
		withReloadDaemon(fixture, (daemon) =>
			Effect.gen(function* () {
				yield* daemon.edit({
					cloud: { cwd: "/synthetic/workspace", environmentId: "synthetic-environment" },
					concurrency: 5,
					provider: "cloud",
					worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
				});
				const config = yield* daemon.config((current) => current.restartRequired.length > 0);
				expect(config.restartRequired).toEqual(["cloud", "provider", "worker"]);
				expect(config.settings).toMatchObject({ concurrency: 5, provider: "local" });
				expect(config.settings.cloud).toBeUndefined();
				expect(renderStatus(yield* daemon.client("daemon.status", {}))).toContain("Restart to apply: cloud, provider, worker");
			}),
		),
	));

test("an edited guidance path applies to the next launch and a missing guidance file is rejected by field", () =>
	withHost(
		{ "first.txt": "First synthetic guidance.", "one.md": task("one", "approved"), "second.txt": "Second synthetic guidance." },
		{ worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", workerGuidance: { file: "first.txt" } } },
		(fixture) =>
			withReloadDaemon(fixture, (daemon) =>
				Effect.gen(function* () {
					const one = yield* daemon.launched("one");
					expect(one.attempts[0]?.prompt).toContain("First synthetic guidance.");
					const worker = { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh" };
					yield* daemon.edit({ worker: { ...worker, workerGuidance: { file: "missing.txt" } } });
					const rejected = yield* daemon.config((config) => config.rejected !== undefined);
					expect(rejected.rejected?.field).toBe("worker.workerGuidance");
					yield* daemon.edit({ worker: { ...worker, workerGuidance: { file: "second.txt" } } });
					yield* daemon.config((config) => config.rejected === undefined);
					fixture.write("two.md", task("two", "approved"));
					const two = yield* daemon.launched("two");
					expect(two.attempts[0]?.prompt).toContain("Second synthetic guidance.");
					expect(two.attempts[0]?.prompt).not.toContain("First synthetic guidance.");
				}),
			),
	));

test("edits saved by replacing the file keep applying", () =>
	withHost({}, { concurrency: 3 }, (fixture) =>
		withReloadDaemon(fixture, (daemon) =>
			Effect.gen(function* () {
				for (const concurrency of [4, 5]) {
					yield* daemon.replace({ concurrency });
					yield* daemon.config((config) => config.settings.concurrency === concurrency);
				}
				yield* daemon.edit({ concurrency: 6 });
				yield* daemon.config((config) => config.settings.concurrency === 6);
			}),
		),
	));

test("every reloadable setting reaches the policy the engine reads on its next pass", () =>
	withHost(
		{ "first.txt": "First review guidance.", "second.txt": "Second review guidance." },
		{
			worker: { branchPrefix: "test/", reviewerGuidance: { file: "first.txt" }, sharedEnvironment: "/synthetic/env.sh" },
		},
		(fixture) =>
			withReloadDaemon(fixture, (daemon) =>
				Effect.gen(function* () {
					const before = yield* daemon.policy;
					expect(yield* before.readGuidance?.("reviewer") ?? Effect.succeed(undefined)).toBe("First review guidance.");
					yield* daemon.edit({
						areaMergeWaitMs: 1234,
						backlog: 7,
						quota: "codex",
						stallMinutes: 9,
						worker: { branchPrefix: "test/", reviewerGuidance: { file: "second.txt" }, sharedEnvironment: "/synthetic/env.sh" },
					});
					yield* daemon.config((config) => config.settings.backlog === 7);
					const after = yield* daemon.policy;
					expect(after).toMatchObject({ areaMergeWaitMs: 1234, deliveryBacklog: 7, stallMinutes: 9 });
					expect(after.refreshQuota).not.toBe(before.refreshQuota);
					expect(yield* after.readGuidance?.("reviewer") ?? Effect.succeed(undefined)).toBe("Second review guidance.");
				}),
			),
	));
