import { expect } from "vitest";
import { lowMemoryPostgres, withRecovery } from "#test/low-memory/postgres.ts";

for (const [recovery, traits] of [
	["without", []],
	["with", [withRecovery]],
] as const) {
	lowMemoryPostgres.it(
		`the preset survives a restart ${recovery} point-in-time recovery`,
		traits,
		function* ({ applyPreset, configureArchiveTimeout, restart, settings }) {
			expect((yield* settings()).shared_buffers).toBe("16384 8kB");

			yield* configureArchiveTimeout(60);
			yield* applyPreset();
			yield* restart();

			expect(yield* settings()).toMatchObject({
				"autovacuum_max_workers": "2",
				"autovacuum_work_mem": "32768 kB",
				"hash_mem_multiplier": "1",
				"idle_in_transaction_session_timeout": "600000 ms",
				"idle_session_timeout": "0 ms",
				jit: "off",
				"max_connections": "50",
				"max_parallel_workers_per_gather": "0",
				"shared_buffers": "4096 8kB",
				"wal_buffers": "512 8kB",
				"wal_compression": "zstd",
				...(recovery === "with" ? { "archive_timeout": "300 s" } : { "archive_mode": "off", "archive_timeout": "60 s" }),
			});
		},
	);
}

lowMemoryPostgres.it(
	"the preset and unprivileged trim lower shared and cgroup memory while preserving the consumer's data",
	[],
	function* ({ applyPreset, cgroupMemory, settings, sharedMemory, storedPayloads, restart, startApp, trim, warmData }) {
		const settingsBefore = yield* settings();
		const sharedBefore = yield* sharedMemory();
		yield* applyPreset();
		yield* restart();
		yield* startApp();
		yield* warmData();
		const settingsAfter = yield* settings();
		expect(settingsAfter.shared_buffers).not.toBe(settingsBefore.shared_buffers);
		expect(yield* sharedMemory()).toBeLessThan(sharedBefore);
		const before = yield* cgroupMemory();

		yield* trim();

		const after = yield* cgroupMemory();
		expect(after).toBeLessThan(before - 64 * 1024 * 1024);
		expect(yield* storedPayloads()).toEqual([{ bytes: 134_217_728, count: 32_768, intact: true }]);
	},
	120_000,
);

lowMemoryPostgres.it(
	"the consumer still receives a committed change through LISTEN after a trim",
	[],
	function* ({ applyPreset, nextHint, publishChange, restart, startApp, trim }) {
		yield* applyPreset();
		yield* restart();
		yield* startApp();
		yield* publishChange();
		expect(yield* nextHint()).toBe("changed the list");

		yield* trim();

		yield* publishChange();
		expect(yield* nextHint()).toBe("changed the list");
	},
	120_000,
);

lowMemoryPostgres.it(
	"the preset reloads query settings while shared memory awaits a restart",
	[],
	function* ({ applyPreset, reloadReceived, settings }) {
		const before = yield* settings();
		expect(before.jit).toBe("on");

		yield* applyPreset();
		yield* reloadReceived();

		expect(yield* settings()).toMatchObject({
			"idle_in_transaction_session_timeout": "600000 ms",
			jit: "off",
			"shared_buffers": before.shared_buffers,
		});
	},
	120_000,
);
