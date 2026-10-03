import { Effect } from "effect";
import type { SetupFailure } from "../failure.ts";
import { type Git, git, gitOrFail } from "./command.ts";

export interface Changes {
	readonly files: ReadonlySet<string>;
	readonly moves: ReadonlyMap<string, string>;
}

export const readAt = (root: string, commit: string, path: string): Effect.Effect<string | undefined, SetupFailure, Git> =>
	Effect.gen(function* () {
		const object = `${commit}:./${path}`;
		const present = yield* git(root, ["cat-file", "-e", object]);
		return present.code === 0 ? yield* gitOrFail(root, ["cat-file", "blob", object]) : undefined;
	});

const parse = (output: string): Changes => {
	const fields = output.split("\0");
	const files = new Set<string>();
	const moves = new Map<string, string>();
	for (let index = 0; index < fields.length - 1; ) {
		const status = fields[index] ?? "";
		const paths = fields.slice(index + 1, index + (/^[RC]/u.test(status) ? 3 : 2));
		for (const path of paths) {
			files.add(path);
		}
		const [from, to] = paths;
		if (status.startsWith("R") && from !== undefined && to !== undefined) {
			moves.set(from, to);
		}
		index += paths.length + 1;
	}
	return { files, moves };
};

// Paths are relative to the root, and only tracked files count: a move is seen once both of its sides are staged.
export const changesSince = (root: string, revision: ReadonlyArray<string>): Effect.Effect<Changes, SetupFailure, Git> =>
	Effect.map(
		gitOrFail(root, ["diff", "--no-color", "--no-ext-diff", "--find-renames", "--name-status", "-z", "--relative", ...revision, "--"]),
		parse,
	);
