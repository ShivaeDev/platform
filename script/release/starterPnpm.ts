import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";

const STARTER_PATH = "examples/starter/package.json";
const Manifest = Schema.fromJsonString(Schema.Struct({ packageManager: Schema.String }));

const readPin = Effect.fn("Release.readPin")(function* (root: string, path: string) {
	const text = yield* (yield* FileSystem.FileSystem).readFileString(join(root, path));
	const manifest = yield* Schema.decodeUnknownEffect(Manifest)(text).pipe(
		Effect.mapError((cause) => new ChangesetError({ cause, message: `${path}: set packageManager to a pinned pnpm version.` })),
	);
	const version = manifest.packageManager.replace(/^pnpm@/u, "").replace(/\+.*$/u, "");
	return { text, version };
});

export const checkStarterPnpm = Effect.fn("Release.checkStarterPnpm")(function* (root: string) {
	const expected = yield* readPin(root, "package.json");
	const pinned = yield* readPin(root, STARTER_PATH);
	if (pinned.version !== expected.version) {
		return yield* new ChangesetError({
			message: `${STARTER_PATH}: pnpm pin ${pinned.version} differs from root package.json pnpm version ${expected.version}. Run pnpm releases apply for a release, or set packageManager to pnpm@${expected.version} in ${STARTER_PATH}.`,
		});
	}
});

export const alignStarterPnpm = Effect.fn("Release.alignStarterPnpm")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const expected = yield* readPin(root, "package.json");
	const pinned = yield* readPin(root, STARTER_PATH);
	if (pinned.version !== expected.version) {
		yield* fs.writeFileString(
			join(root, STARTER_PATH),
			pinned.text.replace(/(?<key>"packageManager"\s*:\s*")[^"]+(?<end>")/u, `$<key>pnpm@${expected.version}$<end>`),
		);
	}
});
