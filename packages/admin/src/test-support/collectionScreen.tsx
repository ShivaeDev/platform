import { RegistryContext } from "@effect/atom-react";
import { Effect, Option, Ref } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Access } from "./Access.ts";
import { CollectionView } from "./CollectionView.tsx";
import { collectionDatabase, collectionEngine, configured } from "./collectionEngine.ts";

type Engine = Effect.Success<typeof collectionEngine> & { screen: Rendered | undefined };

const openScreen = Effect.fnUntraced(function* (engine: Engine) {
	engine.screen = yield* Effect.acquireRelease(
		Effect.promise(() =>
			render(
				<RegistryContext.Provider value={engine.registry}>
					<CollectionView query={engine.query} />
				</RegistryContext.Provider>,
			),
		),
		(view) => Effect.promise(view.unmount),
	);
	yield* Effect.promise(() =>
		act(async () => {
			await Effect.runPromiseExit(AtomRegistry.getResult(engine.registry, engine.query));
		}),
	);
});

export const collectionScreen = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Generator<typeof collectionEngine, Engine, never> {
		return { ...(yield* collectionEngine), screen: undefined };
	},
	layer: collectionDatabase,
	name: "session-scoped admin collection screen",
	runIf: configured,
	stages: ["session", "workspaces"],
	verbs: (engine, story) => ({
		open: () => {
			story.tell("the caller opens the session-scoped collection page in its owning registry");
			Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
			return openScreen(engine);
		},
		shown: () => engine.screen?.container.textContent,
	}),
});

export function signedInAs(id: string, role: typeof Access.Role.Type) {
	return collectionScreen.trait("session", `${id} is signed in as ${role}`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: `${id}@example.test`, id, name: id, role } })),
	);
}

export const withWorkspace = collectionScreen.trait("workspaces", "a workspace exists in tenant one", ({ repository, services }) =>
	repository.insert({ tenant: "tenant one", title: "Studio" }).pipe(Effect.provideContext(services)),
);
