import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { RememberedApp } from "#test/remembered-session/App.tsx";
import { type ProviderSession, providerSession, type RememberedClient, rememberedClient, type User } from "#test/remembered-session/client.ts";
import { Screen } from "#test/Screen.ts";

const HOUR = 3_600_000;

interface Engine {
	readonly client: RememberedClient;
	readonly clock: Effect.Success<typeof watchedClock>;
	readonly screen: Screen;
	view?: Rendered;
}

function opened(engine: Engine) {
	if (engine.view === undefined) {
		throw new Error("The app has not launched");
	}
	return engine.view;
}

export const rememberedSessions = storyKit({
	clock: "test",
	*create() {
		const clock = yield* watchedClock;
		const client = rememberedClient(clock);
		yield* Effect.addFinalizer(() => Effect.sync(() => globalThis.localStorage.clear()));
		const engine: Engine = { client, clock, screen: new Screen(() => undefined) };
		return engine;
	},
	inspect: (engine) => ({ checks: engine.client.reads.length, text: engine.view?.container.textContent }),
	name: "remembered session launch",
	stages: ["memory"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		function answer(line: string, session: ProviderSession | null) {
			return engine.screen.act(line, () => engine.client.answer(session));
		}
		return {
			answers: (user: User, grants: readonly string[]) =>
				answer(`the session check answers ${user} with ${grants.join(", ") || "no grants"}`, providerSession(user, grants, 2 * HOUR)),
			checkFails: () => engine.screen.act("the session check fails without a network", engine.client.fail),
			heldAtoms: (user: User) =>
				Effect.sync(() => {
					const generation = engine.client.generations.find((candidate) => candidate.user === user);
					if (generation === undefined) {
						throw new Error(`${user} never had a generation`);
					}
					return generation.registry.getNodes().size;
				}),
			launches: () =>
				Effect.gen(function* () {
					story.tell("the app launches");
					const session = engine.client.session();
					engine.view = yield* engine.screen.open(<RememberedApp client={engine.client} session={session} />);
				}),
			refreshing: () => Effect.sync(() => opened(engine).container.querySelector("main")?.getAttribute("aria-busy") ?? "no shell"),
			remembered: () => engine.client.stored,
			shown: () => Effect.sync(() => opened(engine).container.textContent),
			signedOutAnswer: () => answer("the session check answers signed out", null),
			timePasses: (millis: number) => engine.screen.act(`${millis} ms pass`, () => Effect.runPromise(engine.clock.adjust(millis))),
		};
	},
});

export function aliceRemembered(grants: readonly string[] = ["notes.read", "notes.write"]) {
	return rememberedSessions.trait("memory", `alice's last verified session with ${grants.join(", ")} is remembered for an hour`, (engine) =>
		engine.client.remember(providerSession("alice", grants, HOUR)),
	);
}

export const rememberedFor = HOUR;
