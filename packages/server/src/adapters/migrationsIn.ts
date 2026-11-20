import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { migrationsFromDirectory } from "@shivaedev/sql/migrationsFromDirectory.ts";

// Node supplies the file system here, so a registration's migrations need nothing from the host that runs them.
export function migrationsIn(directory: string) {
	return { loader: migrationsFromDirectory(directory).pipe(Effect.provide(NodeServices.layer)) };
}
