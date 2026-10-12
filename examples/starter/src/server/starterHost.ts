import { Config, Effect, Layer, Redacted } from "effect";
import { AppChanges, appHost } from "@shivaedev/platform/appHost.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Notes, Subscribe } from "#notes.ts";
import { makeAuth } from "./auth.ts";
import { databaseOptions } from "./databaseOptions.ts";
import { NotesService } from "./NotesService.ts";
import { CountWords, NoteJobs } from "./noteJobs.ts";

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		const changes = yield* AppChanges;
		return Notes.of({
			"notes.create": (input) => Effect.flatMap(Identity, ({ id }) => service.create(input, id)),
			"notes.list": () => Effect.flatMap(Identity, ({ id }) => service.list(id)),
			"notes.subscribe": () => changes.stream(Subscribe.reads(undefined)),
		});
	}),
);

export function starterHost(config?: {
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly port?: number;
	readonly secret?: Redacted.Redacted<string>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.redacted("DATABASE_URL"));
			const { auth, routes, sessions } = yield* makeAuth({ databaseUrl, ...(config?.secret === undefined ? {} : { secret: config.secret }) });
			const database = databaseOptions(auth, databaseUrl);
			const producer = NoteJobs.layer({ connectionString: Redacted.value(databaseUrl), jobs: [CountWords] });
			return appHost({
				assets: { root: "dist", spa: true },
				config: { ...database.config, ...(config?.port === undefined ? {} : { port: config.port }) },
				group: Notes,
				handlers,
				migrations: database.migrations,
				routes,
				services: NotesService.layer.pipe(Layer.provideMerge(producer)),
				sessions,
			});
		}),
	);
}
