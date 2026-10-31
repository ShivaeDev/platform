import type { PgBoss } from "pg-boss";

// pg-boss offers no hook for a worker fetch that finds nothing, so the controller recognizes its claim statement on the client's database.
const claim = /UPDATE\s+\S+\s+j\s+SET\s+state\s*=\s*'active'/u;
const claimedQueue = /\bj\.name\s*=\s*'(?<queue>[^']+)'/u;

export interface TestingFetches {
	readonly begun: (queue: string) => number;
	readonly passedSince: (queue: string, begun: number) => number;
}

export function testingFetches(db: ReturnType<PgBoss["getDb"]>, changed: () => void): TestingFetches {
	const begun = new Map<string, number>();
	const passed = new Map<string, number[]>();
	const executeSql = db.executeSql.bind(db);
	db.executeSql = async (text: string, values?: unknown[]) => {
		const queue = claim.test(text) ? claimedQueue.exec(text)?.groups?.queue : undefined;
		if (queue === undefined) {
			return executeSql(text, values);
		}
		const ordinal = (begun.get(queue) ?? 0) + 1;
		begun.set(queue, ordinal);
		try {
			return await executeSql(text, values);
		} finally {
			const ordinals = passed.get(queue) ?? [];
			ordinals.push(ordinal);
			passed.set(queue, ordinals);
			changed();
		}
	};
	return {
		begun: (queue) => begun.get(queue) ?? 0,
		passedSince: (queue, mark) => (passed.get(queue) ?? []).filter((ordinal) => ordinal > mark).length,
	};
}
