import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import type { EngineStory } from "#test/engineState.ts";
import { engine, engineStoryDefinition } from "#test/engineStory.ts";
import { recoveryDaemon } from "#test/recoveryDaemon.ts";

export const daemonRecovery = {
	...engineStoryDefinition,
	around: withIsolatedDatabase,
	clock: "live" as const,
	verbs: (state: EngineStory) => ({ stopDaemon: () => recoveryDaemon(state) }),
};
export const daemonBoard = engine.trait("configuration", "a PostgreSQL daemon shares the engine's Board and provider", (state) => {
	state.markdown = true;
});
