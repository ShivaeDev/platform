import { Deferred, Effect } from "effect";
import { act } from "react";
import { settleScreen } from "#test/settleScreen.ts";
import { answerWord } from "./hintWords.ts";
import { apiSave, type LiveEngine, view } from "./liveEngine.ts";

type Editor = "writer" | "reader";

export function liveVerbs(engine: LiveEngine, tell: (line: string) => void) {
	const { server, gate, baseline } = engine;
	function settle() {
		return settleEditors(engine, tell);
	}
	function hinted(action: () => Promise<void>) {
		return Effect.promise(() =>
			act(async () => {
				const hints = Promise.all([...engine.views.values()].map((screen) => screen.nextHint()));
				await action();
				await hints;
			}),
		).pipe(Effect.andThen(settle()));
	}
	function edit(editor: Editor, field: "name" | "quantity", value: string) {
		tell(`${editor} enters the ${field} ${JSON.stringify(value)}`);
		return Effect.promise(() => view(engine, editor).edit(field, value));
	}
	return {
		answers: () => Effect.sync(() => [...engine.answers]),
		deliveries: () =>
			Effect.sync(() => server.delivered.slice(baseline.deliveries).map((rows) => rows.map((row) => `${row.name} / ${row.quantity}`).join(", "))),
		editName: (editor: Editor, name: string) => edit(editor, "name", name),
		editor: (name: Editor) =>
			Effect.sync(() => {
				const screen = view(engine, name);
				return {
					name: screen.input("name").value,
					quantity: screen.input("quantity").value,
					server: screen.container.querySelector("output")?.textContent,
					status: screen.container.querySelector('[role="status"]')?.textContent,
				};
			}),
		editQuantity: (editor: Editor, quantity: string) => edit(editor, "quantity", quantity),
		forbiddenSave: (token?: string) =>
			Effect.promise(async () => {
				tell(`${token ?? "an anonymous caller"} tries to overwrite the order`);
				engine.answers.push(answerWord(await apiSave(server.url, "Forbidden", 1, token)));
			}),
		publications: () => Effect.sync(() => server.publications.slice(baseline.publications)),
		readsSinceAction: () => Effect.sync(() => server.reads.slice(baseline.reads)),
		rejectedSave: () =>
			Effect.gen(function* () {
				tell("Alice's API save rolls back at commit; then she saves After rollback through the API");
				const rejected = apiSave(server.url, "Rolled back", 999, "alice-session");
				yield* Deferred.await(gate.entered);
				yield* Deferred.succeed(gate.released, undefined);
				engine.answers.push(answerWord(yield* Effect.promise(() => rejected)));
				yield* hinted(async () => {
					engine.answers.push(answerWord(await apiSave(server.url, "After rollback", 300, "alice-session")));
				});
			}),
		releaseCommit: () => {
			tell("the held transaction commits");
			return hinted(async () => {
				await Effect.runPromise(Deferred.succeed(gate.released, undefined));
			});
		},
		revertOrder: (editor: Editor) => {
			tell(`${editor} reverts the draft`);
			return Effect.promise(() => view(engine, editor).click("Revert")).pipe(Effect.andThen(settle()));
		},
		storedOrder: () => Effect.promise(async () => (await server.read()).map((row) => `${row.name} / ${row.quantity}`)),
		submitOrder: (editor: Editor) => {
			tell(`${editor} submits the order`);
			function click() {
				return view(engine, editor).click("Save");
			}
			if (gate.held && !Deferred.isDoneUnsafe(gate.released)) {
				return Effect.promise(click).pipe(Effect.andThen(Deferred.await(gate.entered)));
			}
			return hinted(click);
		},
	};
}

export function settleEditors(engine: LiveEngine, tell: (line: string) => void) {
	return settleScreen(
		document.body,
		() =>
			[...engine.views.values()].some(
				(screen) =>
					screen.registry.get(screen.status).connection !== "live"
					|| screen.registry.get(screen.query).waiting
					|| screen.container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled === true,
			),
		tell,
	);
}

export function markBaseline(engine: LiveEngine) {
	engine.baseline.deliveries = engine.server.delivered.length;
	engine.baseline.publications = engine.server.publications.length;
	engine.baseline.reads = engine.server.reads.length;
}
