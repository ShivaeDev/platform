import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import type { Batch, WorkSpec } from "./domain.ts";
import { failure } from "./ports.ts";
export function canonicalPath(value: string): Effect.Effect<string, import("effect").PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const absolute = path.resolve(value);
		if (yield* fs.exists(absolute)) {
			return yield* fs.realPath(absolute);
		}
		const parent = path.dirname(absolute);
		if (parent === absolute) {
			return absolute;
		}
		return path.join(yield* canonicalPath(parent), path.basename(absolute));
	});
}
export function within(parent: string, child: string) {
	return parent === child || child.startsWith(parent.endsWith("/") ? parent : `${parent}/`);
}
export function normalizeBatch(batch: Batch, database: string) {
	return Effect.gen(function* () {
		const works = yield* Effect.forEach(batch.works, (work) =>
			Effect.map(canonicalPath(work.checkout), (checkout) => ({ ...work, checkout, repository: work.repository.toLowerCase() })),
		);
		yield* guardDatabase(database, works);
		return { ...batch, works };
	}).pipe(
		Effect.provide(NodeServices.layer),
		Effect.mapError(() => failure("Cannot resolve work paths or the database is inside a worker checkout")),
	);
}
export function guardDatabase(database: string, works: ReadonlyArray<WorkSpec>) {
	return Effect.gen(function* () {
		if (database === ":memory:") {
			return;
		}
		const filename = yield* canonicalPath(database);
		for (const work of works) {
			const checkout = yield* canonicalPath(work.checkout);
			if (within(checkout, filename)) {
				return yield* Effect.fail(failure("Fleet authority storage must be outside every worker checkout"));
			}
		}
	});
}
