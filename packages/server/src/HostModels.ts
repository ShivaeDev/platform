import { Context, Effect, Layer, Schema } from "effect";
import { schemaFieldKeys } from "@shivaedev/errors/schemaFieldScope.ts";
import { collectRepositoryModels, type RepositoryModel, RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";

// The field names of every model the host's repositories declare, which its redaction policy masks.
export class HostModels extends Context.Service<HostModels, { readonly fieldNames: ReadonlySet<string> }>()("@shivaedev/server/HostModels") {}

function recordFields(fieldNames: Set<string>, { model }: RepositoryModel) {
	return Effect.sync(() => {
		for (const key of schemaFieldKeys(Schema.Struct(model.fields).ast, [])) {
			fieldNames.add(key);
		}
	});
}

// Each host provides its own collector around everything it builds, including a deferred application Effect, so a
// repository built there reports its owned models and sensitive fields to the same host that serves and masks them.
export function hostModels() {
	return Layer.effectContext(
		Effect.gen(function* () {
			const collected = yield* RepositoryModels;
			const fieldNames = new Set<string>();
			const models = RepositoryModels.of({
				declare: (declared) => Effect.andThen(recordFields(fieldNames, declared), collected.declare(declared)),
				owned: collected.owned,
			});
			return Context.make(HostModels, { fieldNames }).pipe(Context.add(RepositoryModels, models));
		}),
	).pipe(Layer.provide(Layer.fresh(collectRepositoryModels)));
}
