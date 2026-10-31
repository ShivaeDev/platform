import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createApplication } from "./applicationEngine.ts";
import { hasPostgres, orderDatabase } from "./postgres.ts";
import { orderVerbs } from "./verbs.ts";

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const engine = yield* createApplication;
		window.location.href = engine.url;
		return engine;
	},
	inspect: (engine) => ({
		changes: engine.changes,
		orders: [...engine.orders],
		screens: Object.fromEntries([...engine.screens].map(([name, screen]) => [name, screen.container.textContent])),
	}),
	layer: orderDatabase,
	name: "orders",
	runIf: hasPostgres,
	stages: ["orders", "screen"],
	verbs: (engine, story) => orderVerbs(engine, story.tell),
});
