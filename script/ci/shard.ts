import { Result } from "effect";
import { CiFailure } from "#ci/Failure.ts";

export interface Shard {
	readonly count: number;
	readonly index: number;
}

export interface TestFile {
	readonly name: string;
	readonly workers: number;
}

// Measured on CI runners: however many workers a parallel group has, the runner finishes about 2.6 seconds of recorded test time per second.
const RUNNER_PARALLELISM = 2.6;
// A serial file waits for its own fork to start and import under coverage, about 7 s that its recorded duration leaves out.
const SERIAL_START_UP_MS = 7000;
const UNMEASURED_MS = 1000;

export function parseShard(value: string): Result.Result<Shard, CiFailure> {
	const match = /^(?<index>\d+)\/(?<count>\d+)$/u.exec(value);
	const index = Number(match?.groups?.index);
	const count = Number(match?.groups?.count);
	if (!(Number.isSafeInteger(index) && Number.isSafeInteger(count)) || index < 1 || count < 1 || index > count) {
		return Result.fail(new CiFailure({ message: `Invalid shard ${value}: expected index/count with 1 <= index <= count` }));
	}
	return Result.succeed({ count, index });
}

export function balancedShards<T>(
	items: readonly T[],
	count: number,
	name: (item: T) => string,
	cost: (item: T) => number,
): Result.Result<T[][], CiFailure> {
	if (!Number.isSafeInteger(count) || count < 1) {
		return Result.fail(new CiFailure({ message: "Shard count must be a positive integer" }));
	}
	const groups = Array.from({ length: count }, (): { cost: number; items: T[] } => ({ cost: 0, items: [] }));
	const ordered = [...items].sort((a, b) => cost(b) - cost(a) || name(a).localeCompare(name(b), "en"));
	for (const item of ordered) {
		const selected = groups.reduce((a, b) => (a.cost <= b.cost ? a : b));
		selected.items.push(item);
		selected.cost += cost(item);
	}
	return Result.succeed(groups.map((group) => group.items));
}

export function testFileWallMs(file: TestFile, estimates: Readonly<Record<string, number>>): number {
	const durationMs = estimates[file.name] ?? UNMEASURED_MS;
	return file.workers === 1 ? durationMs + SERIAL_START_UP_MS : durationMs / Math.min(file.workers, RUNNER_PARALLELISM);
}

export function testShards<T>(
	files: readonly T[],
	count: number,
	estimates: Readonly<Record<string, number>>,
	describe: (file: T) => TestFile,
): Result.Result<T[][], CiFailure> {
	const described = files.map((file) => ({ file, test: describe(file) }));
	return Result.map(
		balancedShards(
			described,
			count,
			(item) => item.test.name,
			(item) => testFileWallMs(item.test, estimates),
		),
		(shards) => shards.map((shard) => shard.map((item) => item.file)),
	);
}
