import { Result } from "effect";
import { CiFailure } from "#ci/Failure.ts";

export interface Shard {
	readonly count: number;
	readonly index: number;
}

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
	duration: (item: T) => number,
): Result.Result<T[][], CiFailure> {
	if (!Number.isSafeInteger(count) || count < 1) {
		return Result.fail(new CiFailure({ message: "Shard count must be a positive integer" }));
	}
	const groups = Array.from({ length: count }, (): { duration: number; items: T[] } => ({ duration: 0, items: [] }));
	const ordered = [...items].sort((a, b) => duration(b) - duration(a) || name(a).localeCompare(name(b), "en"));
	for (const item of ordered) {
		const selected = groups.reduce((a, b) => (a.duration <= b.duration ? a : b));
		selected.items.push(item);
		selected.duration += duration(item);
	}
	return Result.succeed(groups.map((group) => group.items));
}
