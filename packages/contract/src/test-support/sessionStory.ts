import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { LiveConnection } from "#automaticLive.ts";
import { sessionEngine } from "#test/sessionEngine.ts";

export const sessionStory = storyKit({
	clock: "live",
	create: () => sessionEngine,
	inspect: (engine) => ({ reads: engine.reads, stored: Object.fromEntries(engine.stored), subscriptions: Object.fromEntries(engine.subscriptions) }),
	name: "session contract",
	stages: [],
	verbs: (engine, story) => ({
		announce: engine.announce,
		bindWithoutOwner: () => engine.clients.alice.withoutOwner(),
		connect: engine.connect,
		connectInOtherRegistry: () => engine.clients.bob.registry.get(engine.clients.alice.api[LiveConnection].connection),
		dispose: (session: "alice" | "bob") => engine.clients[session].registry.dispose(),
		pause: (session: "alice" | "bob", paused: boolean) => engine.clients[session].pause(paused),
		readInOtherRegistry: () => engine.clients.bob.registry.get(engine.clients.alice.api.self.query(undefined)),
		reads: (session: string, query: string) => engine.reads.filter((read) => read === `${session}:${query}`),
		resync: () => engine.server.resync,
		save: (session: "alice" | "bob", title: string) => {
			story.tell(`${session} saves their preferences`);
			return engine.clients[session].run(engine.clients[session].api.save.run({ title }));
		},
		saveFromOtherRuntime: (title: string) => engine.clients.bob.run(engine.clients.alice.api.save.run({ title })),
		status: (session: "alice" | "bob") => engine.clients[session].registry.get(engine.clients[session].api[LiveConnection].status),
		store: (session: string, title: string) =>
			Effect.sync(() => {
				engine.stored.set(session, title);
			}),
		subscriptions: () => Object.fromEntries([...engine.subscriptions].map(([session, queries]) => [session, [...queries.values()].flat()])),
		watch: engine.watch,
	}),
});
