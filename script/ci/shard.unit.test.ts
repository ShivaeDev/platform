import { Result } from "effect";
import { expect, it } from "vitest";
import { balancedShards, parseShard, type TestFile, testFileWallMs, testShards } from "#ci/shard.ts";
import morningSnapshot from "#ci/test-support/morning-shard-snapshot.json" with { type: "json" };
import nightSnapshot from "#ci/test-support/night-shard-snapshot.json" with { type: "json" };

interface SnapshotFixture {
	readonly files: readonly { readonly durationMs: number; readonly path: string; readonly project: string }[];
	readonly shardCount: number;
	readonly smallFiles: readonly { readonly count: number; readonly durationMs: number; readonly project: string }[];
}

type Shards = readonly (readonly TestFile[])[];

function projectWorkers(project: string) {
	return project.endsWith(":heavy") ? 1 : 5;
}

// The fixtures keep every heavy file and every file of 10 s or more, and each project's shorter files as a count and a total.
function snapshotFiles(snapshot: SnapshotFixture) {
	const estimates: Record<string, number> = {};
	const files: TestFile[] = [];
	for (const file of snapshot.files) {
		const name = `${file.project}:${file.path}`;
		estimates[name] = file.durationMs;
		files.push({ name, workers: projectWorkers(file.project) });
	}
	for (const small of snapshot.smallFiles) {
		for (let index = 0; index < small.count; index += 1) {
			const name = `${small.project}:short-${index}`;
			estimates[name] = small.durationMs / small.count;
			files.push({ name, workers: projectWorkers(small.project) });
		}
	}
	return { estimates, files };
}

function slowestSeconds(shards: Shards, estimates: Readonly<Record<string, number>>) {
	return Math.max(...shards.map((shard) => shard.reduce((sum, file) => sum + testFileWallMs(file, estimates), 0))) / 1000;
}

function heavyLoad(shards: Shards, estimates: Readonly<Record<string, number>>) {
	const serial = shards.map((shard) => shard.filter((file) => file.workers === 1).map((file) => estimates[file.name] ?? 0));
	return {
		longFiles: Math.max(...serial.map((durations) => durations.filter((duration) => duration >= 50_000).length)),
		seconds: Math.max(...serial.map((durations) => durations.reduce((sum, duration) => sum + duration, 0))) / 1000,
	};
}

function plans(snapshot: SnapshotFixture) {
	const { estimates, files } = snapshotFiles(snapshot);
	const byDuration = Result.getOrThrow(
		balancedShards(
			files,
			snapshot.shardCount,
			(file) => file.name,
			(file) => estimates[file.name] ?? 0,
		),
	);
	const byWallTime = Result.getOrThrow(testShards(files, snapshot.shardCount, estimates, (file) => file));
	return { byDuration, byWallTime, estimates };
}

function names(shards: readonly (readonly { readonly name: string }[])[]) {
	return shards
		.flat()
		.map((file) => file.name)
		.sort((a, b) => a.localeCompare(b, "en"));
}

function packageShards(items: readonly { name: string; seconds: number }[], count: number) {
	return Result.getOrThrow(
		balancedShards(
			items,
			count,
			(item) => item.name,
			(item) => item.seconds,
		),
	);
}

it("accepts arbitrary shard counts and rejects malformed or out-of-range selections", () => {
	expect(Result.getOrThrow(parseShard("3/7"))).toEqual({ count: 7, index: 3 });
	for (const value of ["0/4", "5/4", "1/0", "-1/4", "1.5/4", "1", "1/4/2", "9007199254740992/9007199254740992"]) {
		expect(Result.isFailure(parseShard(value))).toBe(true);
	}
});

it("balances costs longest first, covers every item once, and ignores discovery order", () => {
	const packages = [
		{ name: "large", seconds: 20 },
		{ name: "small-a", seconds: 5 },
		{ name: "small-b", seconds: 5 },
		{ name: "new-package", seconds: 6 },
	];
	for (const count of [1, 2, 4, 8]) {
		const groups = packageShards(packages, count);
		expect(groups.length).toBe(count);
		expect(names(groups)).toEqual(names([packages]));
		expect(groups).toEqual(packageShards([...packages].reverse(), count));
	}
	expect(packageShards(packages, 2).map((group) => group.reduce((sum, item) => sum + item.seconds, 0))).toEqual([20, 16]);
	expect(
		Result.isFailure(
			balancedShards(
				packages,
				0,
				(item) => item.name,
				(item) => item.seconds,
			),
		),
	).toBe(true);
});

it("assigns every test file to exactly one shard for every count, with a missing, partial or full snapshot", () => {
	const files: TestFile[] = [
		{ name: "app:heavy:boot.heavy.spec.ts", workers: 1 },
		{ name: "app:heavy:gate.heavy.spec.ts", workers: 1 },
		{ name: "app:unit:a.spec.ts", workers: 5 },
		{ name: "app:unit:b.spec.ts", workers: 5 },
		{ name: "app:unit:new.spec.ts", workers: 5 },
		{ name: "app:dom:view.dom.spec.ts", workers: 5 },
		{ name: "app:pure:sum.unit.test.ts", workers: 5 },
	];
	const full = Object.fromEntries(files.map((file, index) => [file.name, (index + 1) * 7000]));
	const { "app:unit:new.spec.ts": _, ...partial } = full;
	const expected = names([files]);
	for (const estimates of [{}, partial, full]) {
		for (let count = 1; count <= files.length + 2; count += 1) {
			const shards = Result.getOrThrow(testShards(files, count, estimates, (file) => file));
			expect(shards.length).toBe(count);
			expect(names(shards)).toEqual(expected);
			expect(shards).toEqual(Result.getOrThrow(testShards([...files].reverse(), count, estimates, (file) => file)));
		}
	}
});

it("weighs a heavy file by its serial time and start-up, and other files by the workers they share", () => {
	const estimates = { "app:heavy:gate.heavy.spec.ts": 60_000, "app:unit:a.spec.ts": 60_000 };
	expect(testFileWallMs({ name: "app:heavy:gate.heavy.spec.ts", workers: 1 }, estimates)).toBeGreaterThan(60_000);
	expect(testFileWallMs({ name: "app:unit:a.spec.ts", workers: 5 }, estimates)).toBeLessThan(30_000);
	expect(testFileWallMs({ name: "app:unit:a.spec.ts", workers: 2 }, estimates)).toBe(30_000);
	expect(testFileWallMs({ name: "app:heavy:new.heavy.spec.ts", workers: 1 }, estimates)).toBeGreaterThan(
		testFileWallMs({ name: "app:unit:new.spec.ts", workers: 5 }, estimates),
	);
});

it("cuts the slowest shard's predicted wall time of last night's snapshots by a third at the same shard count", () => {
	for (const [snapshot, before, after] of [
		[nightSnapshot, 480, 325],
		[morningSnapshot, 460, 305],
	] as const) {
		const { byDuration, byWallTime, estimates } = plans(snapshot);
		expect(slowestSeconds(byDuration, estimates)).toBeGreaterThan(before);
		expect(slowestSeconds(byWallTime, estimates)).toBeLessThan(after);
		expect(names(byWallTime)).toEqual(names(byDuration));
	}
});

it("spreads heavy files of 50 to 90 s instead of piling them into one shard", () => {
	for (const snapshot of [nightSnapshot, morningSnapshot]) {
		const { byDuration, byWallTime, estimates } = plans(snapshot);
		expect(heavyLoad(byDuration, estimates).seconds).toBeGreaterThan(250);
		expect(heavyLoad(byWallTime, estimates).longFiles).toBe(1);
		expect(heavyLoad(byWallTime, estimates).seconds).toBeLessThan(110);
	}
});
