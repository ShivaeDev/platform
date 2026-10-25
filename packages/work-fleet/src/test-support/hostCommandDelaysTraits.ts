import { configureDelayedAnswer, configureDelayedRefresh } from "#test/hostCommandDelays.ts";
import { host } from "#test/hostStory.ts";

export function delayedRefresh(fail = false) {
	return host.trait("configuration", "Git refresh waits for permission to finish", (engine) => {
		configureDelayedRefresh(engine, fail);
	});
}
export function delayedAnswer(operation: "steer" | "startTurn" | "archive", fail = false) {
	return host.trait("configuration", `provider ${operation} can be held`, (engine) => {
		configureDelayedAnswer(engine, operation, fail);
	});
}
