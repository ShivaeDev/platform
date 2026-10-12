import type { Redacted } from "effect";
import { Effect, Option } from "effect";
import { appHost } from "@shivaedev/platform/appHost.ts";
import { Notes } from "#notes.ts";
import { migrations } from "./migrations.ts";
import { NotesService } from "./NotesService.ts";

const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const service = yield* NotesService;
		return Notes.of({ "notes.create": service.create, "notes.list": service.list });
	}),
);

export function starterHost(config?: { readonly databaseUrl?: Redacted.Redacted<string>; readonly port?: number }) {
	return appHost({
		assets: "dist",
		...(config === undefined ? {} : { config }),
		group: Notes,
		handlers,
		migrations,
		services: NotesService.layer,
		sessions: { origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } },
	});
}
