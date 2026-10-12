import type { Redacted } from "effect";
import { Config, Effect, Layer } from "effect";
import { appHost } from "@shivaedev/platform/appHost.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Notes } from "#notes.ts";
import { makeAuth } from "./auth.ts";
import { migrations } from "./migrations.ts";
import { NotesService } from "./NotesService.ts";

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.of({
			"notes.create": (input) => Effect.flatMap(Identity, ({ id }) => service.create(input, id)),
			"notes.list": () => Effect.flatMap(Identity, ({ id }) => service.list(id)),
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
			return appHost({
				assets: { root: "dist", spa: true },
				config: { databaseUrl, ...(config?.port === undefined ? {} : { port: config.port }) },
				group: Notes,
				handlers,
				migrations: migrations(auth),
				routes,
				services: NotesService.layer,
				sessions,
			});
		}),
	);
}
