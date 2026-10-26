import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createApplication } from "./applicationEngine.ts";
import { isolate } from "./isolation.ts";
import { hasPostgres, kitDatabases, workerDatabase } from "./postgres.ts";
import { activeScreens } from "./screens.ts";
import { orderVerbs } from "./verbs.ts";

export const app = storyKit({
	around: isolate,
	clock: "live",
	*create() {
		const initialScreens = activeScreens.size;
		const engine = yield* createApplication;
		window.location.href = engine.url;
		return { ...engine, initialScreens };
	},
	inspect: (engine) => ({
		changes: engine.changes,
		orders: [...engine.orders],
		screens: Object.fromEntries([...engine.screens].map(([name, screen]) => [name, screen.container.textContent])),
	}),
	layer: workerDatabase,
	name: "orders",
	runIf: hasPostgres,
	stages: ["database", "orders", "screen"],
	verbs: (engine, story) => ({
		...orderVerbs(engine, story.tell),
		databaseSetup: () => ({ ...engine.databaseSetup, activeScreens: engine.initialScreens }),
	}),
});

export function realPostgres() {
	return app.trait("database", "the application registers its worker database", (engine) => {
		kitDatabases.add(engine.database.name);
	});
}
