import { expect } from "vitest";
import { appConfigStory } from "#test/appConfigStory.ts";

appConfigStory.it("an application limits its test workers to its database connection budget", [], ({ generate }) => {
	const config = generate({ connectionBudget: 55, connectionsPerWorker: 14 });

	expect(config.test?.maxWorkers).toBe(3);
});

appConfigStory.it("an application can choose an explicit worker limit over its database budget", [], ({ generate }) => {
	const config = generate({ connectionBudget: 56, connectionsPerWorker: 14, maxWorkers: 2 });

	expect(config.test?.maxWorkers).toBe(2);
});
