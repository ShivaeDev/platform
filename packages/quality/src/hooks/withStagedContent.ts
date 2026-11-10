import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { SetupFailure } from "#failure.ts";
import { gitOrFail } from "#git/command.ts";
import { shellWords } from "#hooks/command.ts";
import { orWhenAbsent } from "#inventory/filesystem.ts";

type WorkingCopy =
	| { readonly kind: "absent"; readonly path: string }
	| { readonly blob: string; readonly bytes: Uint8Array; readonly kind: "file"; readonly mode: number; readonly path: string }
	| { readonly kind: "link"; readonly path: string; readonly target: string };

function failed(error: { readonly message: string }): SetupFailure {
	return new SetupFailure({ cause: error, message: error.message });
}

function recovery(copy: WorkingCopy): string {
	const path = shellWords([copy.path]);
	switch (copy.kind) {
		case "absent":
			return `rm -f ${path}`;
		case "file":
			return `git cat-file blob ${copy.blob} > ${path} && chmod ${copy.mode.toString(8)} ${path}`;
		case "link":
			return `ln -sfn ${shellWords([copy.target])} ${path}`;
	}
}

function notice(root: string, copies: readonly WorkingCopy[]): string {
	const [only] = copies;
	const intro =
		copies.length === 1 && only !== undefined
			? `${only.path} changed after staging; Biome checks its staged content in place, then the working copy is put back. If the hook stops first, run this in ${root}:`
			: `${copies.length} files changed after staging; Biome checks their staged content in place, then the working copies are put back. If the hook stops first, run these in ${root}:`;
	return [`quality: ${intro}`, ...copies.map((copy) => `  ${recovery(copy)}`)].join("\n");
}

// The blob outlives a killed hook, so the printed command still recovers the working copy.
const setAside = Effect.fn("Hooks.setAside")(function* (
	root: string,
	path: string,
): Effect.fn.Return<WorkingCopy, SetupFailure, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const fs = yield* FileSystem.FileSystem;
	const at = join(root, path);
	const info = yield* orWhenAbsent(at, fs.lstat(at), undefined).pipe(Effect.mapError(failed));
	if (info === undefined) {
		return { kind: "absent", path };
	}
	if (info.type === "SymbolicLink") {
		return { kind: "link", path, target: yield* fs.readLink(at).pipe(Effect.mapError(failed)) };
	}
	if (info.type !== "File") {
		return yield* new SetupFailure({ message: `${path} changed after staging into a ${info.type}, so the staged check cannot set it aside.` });
	}
	const bytes = yield* fs.readFile(at).pipe(Effect.mapError(failed));
	const blob = (yield* gitOrFail(root, ["hash-object", "-w", "--no-filters", "--", path])).trim();
	return { blob, bytes, kind: "file", mode: info.mode & 0o7777, path };
});

const setAsideAll = Effect.fn("Hooks.setAsideAll")(function* (root: string, paths: readonly string[]) {
	const copies = yield* Effect.forEach(paths, (path) => setAside(root, path));
	yield* Console.log(notice(root, copies));
	return copies;
});

const putBack = Effect.fn("Hooks.putBack")(function* (root: string, copy: WorkingCopy) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const fs = yield* FileSystem.FileSystem;
	const at = join(root, copy.path);
	yield* fs.remove(at, { force: true });
	if (copy.kind === "file") {
		yield* fs.writeFile(at, copy.bytes);
		yield* fs.chmod(at, copy.mode);
	}
	if (copy.kind === "link") {
		yield* fs.symlink(copy.target, at);
	}
});

const restore = Effect.fn("Hooks.restore")(function* (root: string, copies: readonly WorkingCopy[]) {
	const [, failures] = yield* Effect.partition(copies, (copy) => Effect.mapError(putBack(root, copy), (error) => ({ copy, error })));
	if (failures.length === 0) {
		return;
	}
	const lines = failures.map(({ copy, error }) => `quality: cannot put back the working copy of ${copy.path}: ${error.message}\n  ${recovery(copy)}`);
	yield* Console.error(lines.join("\n"));
	return yield* new SetupFailure({
		message: `${failures.length === 1 ? "a working copy was" : `${failures.length} working copies were`} not put back; run the commands above in ${root}.`,
	});
});

// Biome reports no diagnostics for content piped to its stdin, so a file edited again after staging shows Biome its staged content
// on disk until the check ends.
export const withStagedContent = Effect.fn("Hooks.withStagedContent")(function* <TValue, TError, TRequirements>(
	root: string,
	edited: readonly string[],
	check: Effect.Effect<TValue, TError, TRequirements>,
) {
	if (edited.length === 0) {
		return yield* check;
	}
	return yield* Effect.acquireUseRelease(
		setAsideAll(root, edited),
		() => Effect.andThen(gitOrFail(root, ["--literal-pathspecs", "checkout-index", "--force", "--", ...edited]), check),
		(copies) => restore(root, copies),
	);
});
