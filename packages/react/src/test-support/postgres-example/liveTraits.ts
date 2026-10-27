import { Effect } from "effect";
import { integration } from "./integration.ts";

export function commitIsHeld(rejected = false) {
	return integration.trait("commit", `the next commit waits${rejected ? " and rejects" : ""}`, (engine) => {
		engine.gate.held = true;
		engine.gate.rejected = rejected;
	});
}
export function editorsAreOpen(...names: string[]) {
	return integration.trait("editors", `${names.join(" and ")} open live editors`, function* (engine) {
		for (const name of names) {
			engine.views.set(name, yield* Effect.promise(engine.server.mount));
		}
	});
}
