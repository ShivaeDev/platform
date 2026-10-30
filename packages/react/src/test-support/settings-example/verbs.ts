import { Deferred, Effect } from "effect";
import { act } from "react";
import type { Settings } from "./contract.ts";
import { type Engine, screen } from "./engine.ts";
import { request } from "./request.ts";

type Editor = "writer" | "reader" | "bob";

const delivered = Effect.fn("SettingsExample.delivered")(function* (engine: Engine, name: Editor, change: Effect.Effect<void>) {
	const others = [...engine.screens.entries()].filter(([other, view]) => other !== name && view.entityId === screen(engine, name).entityId);
	const hints = others.map(([, view]) => view.nextHint());
	yield* change;
	yield* Effect.promise(() => act(() => Promise.all(hints).then(() => undefined)));
	for (const [, view] of others) {
		yield* view.driver.settle();
	}
});

export function editorVerbs(engine: Engine) {
	function tell(line: string) {
		return engine.screen.tell(line);
	}
	return {
		edit: (name: Editor, field: "title" | "pageSize", value: string) => screen(engine, name).driver.enter(`input[name="${field}"]`, value),
		save: (name: Editor) =>
			delivered(
				engine,
				name,
				screen(engine, name)
					.driver.submit()
					.pipe(Effect.andThen(screen(engine, name).driver.settle())),
			),
		saveUntilCommitWaits: (name: Editor) =>
			screen(engine, name)
				.driver.submit()
				.pipe(
					Effect.andThen(
						Effect.suspend(() => {
							tell("the transaction waits before committing the settings and their invalidation key");
							return Deferred.await(engine.gate.entered);
						}),
					),
				),
		tell,
	};
}

export function verbs(engine: Engine, tell: (line: string) => void) {
	engine.screen.tell = tell;
	const editors = editorVerbs(engine);
	function answered(call: Effect.Effect<string>) {
		return Effect.map(call, (answer) => {
			engine.answers.push(answer);
		});
	}
	return {
		answers: () => Effect.sync(() => [...engine.answers]),
		edit: editors.edit,
		queryAs: (user: "alice" | "bob", entityId: number) => {
			tell(`${user} queries entity ${entityId}'s settings over HTTP`);
			return answered(request(engine.url, `${user}-session`, entityId));
		},
		releaseCommit: () => {
			tell("the settings transaction may commit");
			return delivered(
				engine,
				"writer",
				Deferred.succeed(engine.gate.released, undefined).pipe(Effect.andThen(screen(engine, "writer").driver.settle())),
			);
		},
		save: editors.save,
		saveAs: (user: "alice" | "bob", entityId: number, input: typeof Settings.Type) => {
			tell(`${user} saves entity ${entityId}'s settings as ${input.title} / ${input.pageSize} over HTTP`);
			return answered(request(engine.url, `${user}-session`, entityId, input));
		},
		saveUntilCommitWaits: editors.saveUntilCommitWaits,
		storedSettings: engine.stored,
		view: (name: Editor) =>
			Effect.sync(() => {
				const { container, registry, client } = screen(engine, name);
				return {
					connection: registry.get(client.status).connection,
					error: container.querySelector('[role="alert"]')?.textContent,
					pageSize: container.querySelector<HTMLInputElement>('input[name="pageSize"]')?.value,
					status: container.querySelector('[role="status"]')?.textContent,
					title: container.querySelector<HTMLInputElement>('input[name="title"]')?.value,
					value: container.querySelector("output")?.textContent,
				};
			}),
	};
}
