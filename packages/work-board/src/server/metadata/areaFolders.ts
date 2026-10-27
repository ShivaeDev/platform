import { Effect, FileSystem, Option, Path } from "effect";

export const repositoryRoot = Effect.fn("WorkBoard.repositoryRoot")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (let directory = path.resolve(root); ; directory = path.dirname(directory)) {
		const git = path.join(directory, ".git");
		const info = yield* fs.stat(git).pipe(Effect.option);
		if (Option.isSome(info) && (info.value.type === "File" || (yield* fs.exists(path.join(git, "HEAD"))))) {
			return directory;
		}
		if (path.dirname(directory) === directory) {
			return root;
		}
	}
});

export const isDirectory = Effect.fn("WorkBoard.isDirectory")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.stat(file).pipe(
		Effect.map((info) => info.type === "Directory"),
		Effect.orElseSucceed(() => false),
	);
});

export const childFolders = Effect.fn("WorkBoard.childFolders")(function* (parent: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* isDirectory(parent))) {
		return [];
	}
	return yield* Effect.filter(yield* fs.readDirectory(parent), (name) => isDirectory(path.join(parent, name)));
});

export const packageFolders = Effect.fn("WorkBoard.packageFolders")(function* (repository: string) {
	const path = yield* Path.Path;
	const bases = new Map<string, string>();
	for (const prefix of ["packages", "examples", ""]) {
		for (const name of yield* childFolders(path.join(repository, prefix))) {
			if (!(["packages", "examples", "node_modules", ".git"].includes(name) || bases.has(name))) {
				bases.set(name, path.join(repository, prefix, name));
			}
		}
	}
	return bases;
});
