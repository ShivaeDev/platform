import { pathToFileURL } from "node:url";
import { Effect, Path, Predicate, Schema } from "effect";

type WireSchema = Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

// A generated schema's services are Effect's own codecs, which need none.
function isWireSchema(value: unknown): value is WireSchema {
	return Schema.isSchema(value);
}

export const importedFrom = Effect.fn("BuildStory.importedFrom")(function* (root: string, file: string) {
	const path = yield* Path.Path;
	const imported: unknown = yield* Effect.promise(() => import(pathToFileURL(path.join(root, file)).href));
	return imported;
});

export const successSchema = Effect.fn("BuildStory.successSchema")(function* (root: string, module: string, operation: string) {
	const generated = yield* importedFrom(root, `src/generated/modules/${module}/${module}.ts`);
	const wire = Predicate.hasProperty(generated, `${module}Wire`) ? generated[`${module}Wire`] : undefined;
	const entry = Predicate.hasProperty(wire, operation) ? wire[operation] : undefined;
	const success = Predicate.hasProperty(entry, "success") ? entry.success : undefined;
	return isWireSchema(success) ? success : yield* Effect.die(new Error(`the generated ${module} wire has no success schema for ${operation}`));
});
