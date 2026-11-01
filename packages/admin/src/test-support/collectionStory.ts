import { Effect, Option, Ref } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { Access } from "./Access.ts";
import { answered } from "./answers.ts";
import { collectionDatabase, collectionEngine, configured } from "./collectionEngine.ts";

export const collectionStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => collectionEngine,
	layer: collectionDatabase,
	name: "live admin collection pages",
	runIf: configured,
	stages: ["session", "page"],
	verbs: (engine, story) => ({
		insert: (tenant: string, title: string) => {
			story.tell(`a workspace named ${title} is committed in ${tenant}`);
			engine.before.current = engine.registry.get(engine.query);
			return engine.repository.insert({ tenant, title }).pipe(Effect.provideContext(engine.services));
		},
		load: () => {
			story.tell("the caller loads the live all-workspaces admin query");
			return answered(
				AtomRegistry.getResult(engine.registry, engine.query).pipe(Effect.map((rows) => rows.map((row) => `${row.tenant}: ${row.title}`))),
			);
		},
		shown: () =>
			answered(AtomRegistry.getResult(engine.registry, engine.query).pipe(Effect.map((rows) => rows.map((row) => `${row.tenant}: ${row.title}`)))),
		untilRefreshed: () => {
			story.tell("the mounted admin query receives the committed change");
			return until(
				AtomRegistry.toStream(engine.registry, engine.query),
				(result) => result !== engine.before.current && !AsyncResult.isInitial(result) && !result.waiting,
				{ name: "refreshed admin collection query" },
			);
		},
	}),
});

export function signedInAs(id: string, role: typeof Access.Role.Type) {
	return collectionStory.trait("session", `${id} is signed in with the ${role} role`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: `${id}@example.test`, id, name: id, role } })),
	);
}

export const livePage = collectionStory.trait("page", "the admin mounts the live all-workspaces page", function* ({ api, query, registry }) {
	registry.mount(query);
	yield* until(AtomRegistry.toStream(registry, api[LiveConnection].status), (status) => status.connection === "live", { name: "live admin page" });
	yield* AtomRegistry.getResult(registry, query);
});
