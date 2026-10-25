import { expect } from "vitest";
import { workerKit } from "#quality/test-support/workerKit.ts";

const { it } = workerKit;

it("uses the default connection inputs unless a repository configures them", [], ({ configure, maxWorkers }) => {
	const connectionBudget = 80;
	const connectionsPerWorker = 14;
	const defaultWorkers = maxWorkers();
	configure({ connectionBudget, connectionsPerWorker });
	expect(defaultWorkers).toBe(Math.floor(connectionBudget / connectionsPerWorker));
	expect(maxWorkers()).toBe(defaultWorkers);
});

for (const [connectionBudget, connectionsPerWorker] of [
	[56, 14],
	[84, 14],
	[84, 8],
] as const) {
	it(`fits workers within ${connectionBudget} connections at ${connectionsPerWorker} per worker`, [], ({ configure, maxWorkers }) => {
		configure({ connectionBudget, connectionsPerWorker });
		expect(maxWorkers()).toBe(Math.floor(connectionBudget / connectionsPerWorker));
	});
}

it("uses an explicit worker override ahead of the connection calculation", [], ({ configure, maxWorkers }) => {
	const explicitWorkers = 7;
	configure({ connectionBudget: 56, connectionsPerWorker: 14, maxWorkers: explicitWorkers });
	expect(maxWorkers()).toBe(explicitWorkers);
});

it("rounds down partial workers", [], ({ configure, maxWorkers }) => {
	const connectionBudget = 55;
	const connectionsPerWorker = 14;
	configure({ connectionBudget, connectionsPerWorker });
	expect(maxWorkers()).toBe(Math.floor(connectionBudget / connectionsPerWorker));
});

it("keeps a worker when the budget cannot fit its pool", [], ({ configure, maxWorkers }) => {
	const connectionsPerWorker = 14;
	const connectionBudget = 8;
	configure({ connectionBudget, connectionsPerWorker });
	expect(maxWorkers()).toBe(Math.ceil(connectionBudget / connectionsPerWorker));
});

it("rejects connection inputs that cannot produce a valid worker count", [], ({ configure }) => {
	expect(() => configure({ connectionBudget: 0 })).toThrow(RangeError);
	expect(() => configure({ connectionsPerWorker: -1 })).toThrow(RangeError);
	expect(() => configure({ maxWorkers: 1.5 })).toThrow(RangeError);
});
