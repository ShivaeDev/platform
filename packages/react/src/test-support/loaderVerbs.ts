import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { idleRegistry } from "./idleRegistry.ts";
import { type Engine, opened, sessionRegistry, settle } from "./loaderScreenState.ts";

export function loaderVerbs(engine: Engine, story: { tell: (line: string) => void }) {
	const { host } = engine;
	function presence(atom: Atom.Atom<unknown>) {
		return sessionRegistry(engine).getNodes().has(atom) ? "held" : "released";
	}
	return {
		clickLink: (target: "Home" | "Note") => clickLink(engine, target, story.tell),
		firstRenders: () => Effect.sync(() => [...engine.renders]),
		idleWindowPasses: () =>
			Effect.promise(async () => {
				story.tell("the session registry's idle window passes, shown by an idle atom being swept");
				await act(() => idleRegistry(sessionRegistry(engine)));
			}),
		leave: () =>
			Effect.promise(async () => {
				story.tell("navigate away from the note route");
				await act(async () => {
					await opened(engine).router.navigate({ to: "/" });
				});
			}),
		loaderSource: () => Effect.sync(() => presence(host.source)),
		nextReadWaits: () =>
			Effect.sync(() => {
				story.tell("the server holds its next answer");
				host.next();
			}),
		refresh: () => refresh(engine, story.tell),
		removeLink: (target: "Home" | "Note") =>
			Effect.gen(function* () {
				story.tell(`remove the ${target} link`);
				const link = yield* findLink(engine, target);
				link.remove();
			}),
		rename: (title: string) =>
			Effect.promise(async () => {
				story.tell(`rename the note to ${title}, which invalidates it`);
				await act(async () => {
					await Effect.runPromise(AtomRegistry.getResult(sessionRegistry(engine), host.rename(title)));
				});
			}),
		respond: (title: string) => respond(engine, title, story.tell),
		returnToNote: () =>
			Effect.promise(async () => {
				story.tell("return to the note route");
				await act(async () => {
					await opened(engine).router.navigate({ to: "/note" });
				});
			}),
		routeMounts: () =>
			Effect.promise(async () => {
				story.tell("the router mounts the note route");
				await act(async () => engine.mount.resolve());
			}).pipe(Effect.andThen(settle(engine, story.tell))),
		screenWork: () => Effect.sync(() => (opened(engine).pending() ? "pending" : "settled")),
		serverCalls: () => Effect.sync(() => [...host.calls]),
		shownTitle: () => Effect.sync(() => opened(engine).view.container.querySelector("h1")?.textContent),
		stale: () => Effect.sync(() => opened(engine).view.container.querySelector("article")?.dataset.stale === "true"),
	};
}
export function findLink(engine: Engine, target: "Home" | "Note") {
	return Effect.suspend(() => {
		const link = [...opened(engine).view.container.querySelectorAll("a")].find((candidate) => candidate.textContent === target);
		return link === undefined ? Effect.fail(`missing ${target} link` as const) : Effect.succeed(link);
	});
}

const clickLink = Effect.fnUntraced(function* (engine: Engine, target: "Home" | "Note", tell: (line: string) => void) {
	tell(`click the ${target} link`);
	const link = yield* findLink(engine, target);
	yield* Effect.promise(() => act(async () => link.click()));
	yield* settle(engine, tell);
});

export function refresh(engine: Engine, tell: (line: string) => void) {
	return Effect.promise(async () => {
		tell("click Refresh while the server holds its answer");
		engine.host.next();
		const button = opened(engine).view.container.querySelector("button");
		if (button === null) {
			throw new Error("Missing Refresh button");
		}
		await act(async () => button.click());
	});
}

export function respond(engine: Engine, title: string, tell: (line: string) => void) {
	return Effect.promise(async () => {
		tell(`the server answers ${title}`);
		await act(async () => engine.host.respond(title));
	}).pipe(Effect.andThen(settle(engine, tell)));
}
