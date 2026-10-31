import { Effect } from "effect";
import { integration } from "./integration.ts";
import type { LiveEngine } from "./liveEngine.ts";
import { liveVerbs, markBaseline, settleEditors } from "./liveVerbs.ts";

function quiet() {
	return undefined;
}

function* open(engine: LiveEngine, names: readonly string[]) {
	for (const name of names) {
		engine.views.set(name, yield* Effect.promise(engine.server.mount));
	}
	yield* settleEditors(engine, quiet);
	markBaseline(engine);
}

export function commitIsHeld(rejected = false) {
	return integration.trait("commit", `the next commit waits${rejected ? " and then rolls back" : ""}`, (engine) => {
		engine.gate.held = true;
		engine.gate.rejected = rejected;
	});
}

export function editorsAreOpen(...names: string[]) {
	return integration.trait("editors", `${names.join(" and ")} open live editors on Printer paper / 300`, (engine) => open(engine, names));
}

export function writerCommitHeld() {
	return integration.trait(
		"editors",
		"the writer's save of Office chairs / 450 waits inside its transaction while the reader's editor is open",
		function* (engine) {
			engine.gate.held = true;
			yield* open(engine, ["writer", "reader"]);
			const { editName, editQuantity, submitOrder } = liveVerbs(engine, quiet);
			yield* editName("writer", "  Office chairs  ");
			yield* editQuantity("writer", "450");
			yield* submitOrder("writer");
		},
	);
}

export function liveRefreshBesideDirtyName() {
	return integration.trait(
		"editors",
		"the reader's dirty name Unsaved local name kept through the writer's live save of Remote update / 900",
		function* (engine) {
			yield* open(engine, ["writer", "reader"]);
			const { editName, editQuantity, submitOrder } = liveVerbs(engine, quiet);
			yield* editName("reader", "Unsaved local name");
			yield* editName("writer", "Remote update");
			yield* editQuantity("writer", "900");
			yield* submitOrder("writer");
		},
	);
}
