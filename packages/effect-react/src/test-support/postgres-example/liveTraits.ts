import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "#testing.ts";
import { app } from "./integration.ts";

export function commitIsHeld(rejected = false) {
	return app.trait("commit", `the next commit waits${rejected ? " and rejects" : ""}`, (engine) => {
		engine.gate.held = true;
		engine.gate.rejected = rejected;
	});
}
export function editorsAreOpen(...names: string[]) {
	return app.trait("editors", `${names.join(" and ")} open live editors`, function* (engine) {
		for (const name of names) {
			engine.views.set(name, yield* Effect.promise(engine.server.mount));
		}
		yield* Effect.promise(() =>
			eventually(() => {
				for (const view of engine.views.values()) {
					expect(view.input("name").value).toBe("Printer paper");
					expect(view.input("quantity").value).toBe("300");
					expect(view.registry.get(view.status).connection).toBe("live");
					expect(view.registry.get(view.query).waiting).toBe(false);
				}
				expect(engine.server.reads).toHaveLength(names.length * 2);
			}),
		);
		engine.baseline.reads = engine.server.reads.length;
		engine.baseline.deliveries = engine.server.delivered.length;
	});
}
