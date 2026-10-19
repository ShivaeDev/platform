import { expect } from "vitest";
import { workerKit } from "#quality/test-support/workerKit.ts";

const { it } = workerKit;

it("sizes the default budget using the peak full-app connection estimate", [], ({ maxWorkers }) => {
	const defaultPeakWorkers = 5;
	expect(maxWorkers()).toBe(defaultPeakWorkers);
});

it("allows four workers on a two-CPU runner when the connection budget fits four", [], ({ configure, maxWorkers }) => {
	configure({ connectionBudget: 56, connectionsPerWorker: 14 });
	const ciWorkersWithinBudget = 4;
	expect(maxWorkers()).toBe(ciWorkersWithinBudget);
});

it("limits a ten-CPU laptop to six workers when the connection budget fits six", [], ({ configure, maxWorkers }) => {
	configure({ connectionBudget: 84, connectionsPerWorker: 14 });
	const laptopWorkersWithinBudget = 6;
	expect(maxWorkers()).toBe(laptopWorkersWithinBudget);
});

it("lets a repository's per-worker estimate change the concurrency", [], ({ configure, maxWorkers }) => {
	configure({ connectionBudget: 84, connectionsPerWorker: 8 });
	const workersWithSmallerPools = 10;
	expect(maxWorkers()).toBe(workersWithSmallerPools);
});

it("uses an explicit worker override ahead of the connection calculation", [], ({ configure, maxWorkers }) => {
	configure({ connectionBudget: 56, connectionsPerWorker: 14, maxWorkers: 7 });
	const explicitWorkers = 7;
	expect(maxWorkers()).toBe(explicitWorkers);
});

it("rounds down partial workers and keeps at least one worker", [], ({ configure, maxWorkers }) => {
	configure({ connectionBudget: 55, connectionsPerWorker: 14 });
	const wholeWorkersWithinBudget = 3;
	expect(maxWorkers()).toBe(wholeWorkersWithinBudget);
	configure({ connectionBudget: 8, connectionsPerWorker: 14 });
	const minimumWorkers = 1;
	expect(maxWorkers()).toBe(minimumWorkers);
});

it("rejects connection inputs that cannot produce a valid worker count", [], ({ configure }) => {
	expect(() => configure({ connectionBudget: 0 })).toThrow(RangeError);
	expect(() => configure({ connectionsPerWorker: -1 })).toThrow(RangeError);
	expect(() => configure({ maxWorkers: 1.5 })).toThrow(RangeError);
});
