import { expect } from "vitest";
import { appConfigStory } from "#test/appConfigStory.ts";

appConfigStory.it("an application limits its test workers to its database connection budget", [], ({ generate }) => {
	const connectionBudget = 55;
	const connectionsPerWorker = 14;
	const config = generate({ connectionBudget, connectionsPerWorker });

	expect(config.test?.maxWorkers).toBe(Math.floor(connectionBudget / connectionsPerWorker));
});

appConfigStory.it("an application can choose an explicit worker limit over its database budget", [], ({ generate }) => {
	const maxWorkers = 2;
	const config = generate({ connectionBudget: 56, connectionsPerWorker: 14, maxWorkers });

	expect(config.test?.maxWorkers).toBe(maxWorkers);
});
