import { Deferred, Effect, Fiber } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { SignalNotReceived, UntilOptions } from "@shivaedev/test-story/server/until.ts";
import { untilAtom } from "./untilAtom.ts";

interface Engine {
	atom: Atom.Atom<string>;
	readonly firstSeen: Deferred.Deferred<void>;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly source: Atom.Writable<string>;
	wait?: Fiber.Fiber<string, SignalNotReceived>;
}

function waiting(engine: Engine) {
	if (!engine.wait) {
		throw new Error("No atom wait started");
	}
	return engine.wait;
}

export const atomStory = storyKit({
	*create() {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(owner) => Effect.sync(() => owner.dispose()),
		);
		const source = Atom.make("waiting");
		const engine: Engine = { atom: source, firstSeen: Deferred.makeUnsafe<void>(), registry, source };
		return engine;
	},
	inspect: ({ atom, registry }) => ({ value: registry.get(atom) }),
	name: "native atom waits",
	stages: ["source"],
	verbs: (engine, story) => {
		function waitFor(value: string, options?: UntilOptions) {
			story.tell(`wait for the atom to hold ${value}`);
			return untilAtom(
				engine.registry,
				engine.atom,
				(current) => {
					Deferred.doneUnsafe(engine.firstSeen, Effect.void);
					return current === value;
				},
				options,
			);
		}
		return {
			*beginWaitingFor(value: string) {
				engine.wait = yield* Effect.forkChild(waitFor(value));
				yield* Deferred.await(engine.firstSeen);
			},
			failure: (value: string) =>
				waitFor(value, { name: `atom holding ${value}`, timeout: "30 millis" }).pipe(
					Effect.map((answer) => `received ${answer}`),
					Effect.catchTag("SignalNotReceived", (error) => Effect.succeed(error.message)),
				),
			interruptWait: () => Fiber.interrupt(waiting(engine)).pipe(Effect.asVoid),
			publish: (value: string) =>
				Effect.sync(() => {
					story.tell(`the atom publishes ${value}`);
					engine.registry.set(engine.source, value);
				}),
			subscribed: () => Effect.sync(() => engine.registry.ensureNode(engine.atom).listeners.size > 0),
			waitedValue: () => Fiber.join(waiting(engine)),
			waitFor,
		};
	},
});

export function firstReadPublishes(...values: readonly string[]) {
	return atomStory.trait("source", `the first atom read publishes ${values.join(", ")} before returning later`, (engine) => {
		engine.atom = Atom.make((context) => {
			for (const value of values) {
				context.setSelf(value);
			}
			return "later";
		});
	});
}
