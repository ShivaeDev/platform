import { expect } from "vitest";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("interrupts at the fetch deadline, leaves waiting jobs for expiry, and never overlaps retries", [realPostgres], function* ({ budgets }) {
	yield* budgets.seed();
	yield* budgets.start();
	yield* budgets.firstClaim;
	yield* budgets.startPeer();
	const stored = yield* budgets.completed();
	expect(stored).toHaveLength(4);
	expect(stored.every((job) => job.state === "completed")).toBe(true);
	expect(budgets.batches[0]).toBe(4);
	expect(budgets.peerRetries).toContain(1);
	expect(budgets.peak()).toBe(1);
	expect(budgets.starts.filter(({ retry }) => retry === 0).map(({ id }) => id)).toEqual([0, 1]);
	expect(budgets.starts.every(({ remaining }) => remaining > 0)).toBe(true);
	const later = budgets.starts.find(({ id, retry }) => id === 1 && retry === 0);
	expect(later?.budget).toBeGreaterThan(0);
	expect(later?.budget).toBeLessThan(500);
	for (const start of budgets.starts) {
		expect(Math.abs(start.budget - start.remaining)).toBeLessThan(50);
	}
	expect(budgets.interrupted.map(({ id }) => id)).toEqual([1]);
	expect(budgets.interrupted[0]?.lateness).toBeGreaterThanOrEqual(-20);
	expect(budgets.interrupted[0]?.lateness).toBeLessThan(200);
	expect(budgets.finished).toEqual([0]);
	expect(stored.filter((job) => job.data.id !== 0).every((job) => job.retryCount === 1)).toBe(true);
});
