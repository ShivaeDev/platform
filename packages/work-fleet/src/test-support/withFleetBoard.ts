import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, type Scope } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import type { Fleet } from "#fleet.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { type EngineFixture, withEngine } from "#test/engine.ts";

export function withFleetBoard<A, E>(
	options: EngineOptions,
	use: (
		fixture: EngineFixture<unknown>,
		root: string,
		source: string,
	) => Effect.Effect<A, E, typeof Fleet.Identifier | FileSystem.FileSystem | Path.Path | Scope.Scope>,
) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-http-postgres-" });
		const source = "---\nid: one\nkind: task\nfleet: approved\n---\n# Scoped work\n\nPreserve review and required validation.\n";
		yield* fs.writeFileString(path.join(root, "one.md"), source);
		return yield* withEngine(
			options,
			(fixture) => use(fixture, root, source).pipe(Effect.provide(NodeServices.layer), Effect.scoped),
			markdownBoard(root).pipe(Layer.provide(NodeServices.layer)),
		);
	}).pipe(Effect.provide(NodeServices.layer));
}
