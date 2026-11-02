import { Context, Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { jobModule } from "@shivaedev/jobs/server/jobModule.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import type { AppModule } from "#AppModule.ts";

export class Publisher extends Context.Service<Publisher, (title: string) => Effect.Effect<string>>()("test/modules/Publisher") {}
export class Titles extends Context.Service<Titles, { readonly publish: (title: string) => Effect.Effect<string> }>()("test/modules/Titles") {}

export const Published = defineQueue({
	name: "notes.publish",
	schema: Schema.Struct({ title: Schema.String }),
	worker: { pollingIntervalSeconds: 0.5 },
});
export const Indexed = defineQueue({ name: "tasks.index", schema: Published.schema, worker: { pollingIntervalSeconds: 0.5 } });
const NoteJobs = makePgBoss("test/modules/NoteJobs");
const TaskJobs = makePgBoss("test/modules/TaskJobs");
export const PublishingApi = RpcGroup.make(
	Rpc.make("preview", { payload: { title: Schema.String }, success: Schema.String }),
	Rpc.make("publish", { payload: { title: Schema.String }, success: Schema.String }),
	Rpc.make("index", { payload: { title: Schema.String }, success: Schema.String }),
	Rpc.make("published", { success: Schema.Array(Schema.String) }),
);

const store = Effect.fnUntraced(function* (title: string) {
	const titles = yield* Titles;
	const result = yield* titles.publish(title);
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into published_titles (title) values (${result})`;
});

export const publishingModule = {
	name: "publishing",
	...jobModule(NoteJobs.layer, { jobs: [Published.handle(({ title }) => store(title))] }),
	group: PublishingApi,
	handlers: PublishingApi.toLayer({
		index: ({ title }) => TaskJobs.use((jobs) => jobs.enqueue(Indexed, { title })).pipe(Effect.orDie, Effect.map(Option.getOrThrow)),
		preview: ({ title }) => Titles.use((titles) => titles.publish(title)),
		publish: ({ title }) => NoteJobs.use((jobs) => jobs.enqueue(Published, { title })).pipe(Effect.orDie, Effect.map(Option.getOrThrow)),
		published: () =>
			SqlClient.SqlClient.use((sql) => sql<{ title: string }>`select title from published_titles order by title`).pipe(
				Effect.orDie,
				Effect.map((rows) => rows.map((row) => row.title)),
			),
	}),
	migrations: {
		components: [pgBossSchema()],
		loader: Migrator.fromRecord({ "001_titles": SqlClient.SqlClient.use((sql) => sql`create table published_titles (title text not null)`) }),
	},
	ports: Layer.succeed(Publisher, (title) => Effect.succeed(`Published: ${title}`)),
	services: Layer.effect(
		Titles,
		Effect.map(Publisher, (publish) => ({ publish })),
	).pipe(Layer.merge(NoteJobs.layer({ jobs: [Published] }))),
} satisfies AppModule;

export const indexingModule = {
	name: "indexing",
	...jobModule(TaskJobs.layer, { jobs: [Indexed.handle(({ title }) => store(title))] }),
	group: RpcGroup.make(),
	handlers: Layer.empty,
	migrations: { loader: Migrator.fromRecord({}) },
	services: TaskJobs.layer({ jobs: [Indexed] }),
} satisfies AppModule;
