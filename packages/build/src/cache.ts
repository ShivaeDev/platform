import { Effect, Option, Path, Schema } from "effect";
import { readIfPresent, writeAtomically } from "#files.ts";

const CacheRecord = Schema.Struct({ content: Schema.String, key: Schema.String });

const CacheJson = Schema.fromJsonString(CacheRecord);

const decodeRecord = Schema.decodeUnknownOption(CacheJson);

const encodeRecord = Schema.encodeEffect(CacheJson);

function recordPath(path: Path.Path, root: string, module: string): string {
	return path.join(root, "node_modules", ".cache", "@shivaedev", "build", `${path.relative(root, module)}.json`);
}

// The output of the last run whose inputs had this key; another key, or an unreadable record, means the module must be derived.
export const cachedOutput = Effect.fn("Build.cachedOutput")(function* (root: string, module: string, key: string) {
	const path = yield* Path.Path;
	const text = yield* readIfPresent(recordPath(path, root, module));
	return Option.filter(
		Option.flatMap(text, (json) => decodeRecord(json)),
		(record) => record.key === key,
	).pipe(Option.map((record) => record.content));
});

export const recordOutput = Effect.fn("Build.recordOutput")(function* (root: string, module: string, key: string, content: string) {
	const path = yield* Path.Path;
	yield* writeAtomically(recordPath(path, root, module), yield* encodeRecord({ content, key }));
});
