import { Effect, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { LiveConnection } from "#automaticLive.ts";
import { signedIn } from "#readPolicy.ts";
import { answered, shown } from "./answers.ts";
import { collectionDatabase, collectionEngine, configured } from "./collectionEngine.ts";
import { settled } from "./settled.ts";

const engine = Effect.map(collectionEngine, (value) => ({ ...value, before: value.registry.get(value.query) }));
type Engine = Effect.Success<typeof engine>;

function write<A, E, R>(current: Engine, effect: Effect.Effect<A, E, R>) {
	current.before = current.registry.get(current.query);
	return effect.pipe(Effect.provideContext(current.services));
}

export const collectionStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => engine,
	layer: collectionDatabase,
	name: "permission-gated PostgreSQL collection reads",
	runIf: configured,
	stages: ["policy", "page"],
	verbs: (current, story) => ({
		delete: (id: number) => {
			story.tell(`the repository deletes workspace ${id}`);
			return write(current, current.repository.delete(id));
		},
		insert: (tenant: string, title: string) => {
			story.tell(`the repository inserts ${title} for ${tenant} with a generated id`);
			return write(current, current.repository.insert({ tenant, title }));
		},
		insertMany: (rows: readonly { readonly tenant: string; readonly title: string }[]) => {
			story.tell("the repository inserts a batch of workspaces");
			return write(current, current.repository.insertMany(rows));
		},
		memberReads: () => {
			story.tell("a member reads the all-workspaces query");
			return answered(current.member("workspaces.all", undefined), (rows) => JSON.stringify(rows));
		},
		memberSubscribes: () => {
			story.tell("a member without the admin permission subscribes to every workspace");
			return answered(Stream.runHead(current.member("workspaces.$changes", { queries: [{ payload: undefined, query: "all" }] })), () => "subscribed");
		},
		revokePermission: () => {
			story.tell("the admin loses the workspace management permission");
			return Effect.sync(() => current.permissions.clear());
		},
		shown: () =>
			Effect.map(settled(current.registry, current.query), (value) => shown(value, (rows) => rows.map((row) => `${row.tenant}: ${row.title}`))),
		untilRefreshed: () => {
			story.tell("the mounted admin query receives a new result after the committed write");
			return until(AtomRegistry.toStream(current.registry, current.query), (value) => value !== current.before && !value.waiting, {
				name: "refreshed collection query",
			});
		},
		update: (id: number, tenant: string, title: string) => {
			story.tell(`the repository changes workspace ${id} to ${title} for ${tenant}`);
			return write(current, current.repository.update({ id, tenant, title }));
		},
		upsert: (tenant: string, title: string) => {
			story.tell(`the repository upserts ${title} for ${tenant}`);
			return write(current, current.repository.upsert({ tenant, title }, { updateColumns: ["tenant"] }));
		},
		upsertMany: (rows: readonly { readonly tenant: string; readonly title: string }[]) => {
			story.tell("the repository upserts a batch of workspaces");
			return write(current, current.repository.upsertMany(rows, { updateColumns: ["tenant"] }));
		},
	}),
});

export const adminPage = collectionStory.trait("page", "an admin mounts the all-workspaces query and its live subscription", function* (current) {
	current.registry.mount(current.query);
	yield* until(AtomRegistry.toStream(current.registry, current.api[LiveConnection].status), (status) => status.connection === "live", {
		name: "live admin collection query",
	});
	yield* settled(current.registry, current.query);
});

export const memberPolicy = collectionStory.trait("policy", "an untyped collection query declares only the signed-in member policy", (current) => {
	Reflect.set(current.definition, "readPolicy", signedIn);
});
