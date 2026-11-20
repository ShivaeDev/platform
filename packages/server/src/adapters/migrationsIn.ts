import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";

// Node supplies the file system here, so a registration's migrations need nothing from the host that runs them.
export function migrationsIn(directory: string) {
	return {
		loader: Effect.flatMap(Path.Path, (path) => MigratorFileSystem.fromFileSystem(path.join(directory, "migrations"))).pipe(
			Effect.provide(NodeServices.layer),
		),
	};
}
