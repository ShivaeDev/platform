import { Effect, type FileSystem, type PubSub, Stream } from "effect";

export interface IndexAccesses {
	readonly checks: string[];
	readonly input: PubSub.PubSub<FileSystem.WatchEvent>;
	readonly reads: string[];
	readonly scans: string[];
}

export function watchedIndexFilesystem(fs: FileSystem.FileSystem, accesses: IndexAccesses): FileSystem.FileSystem {
	function track<A, E>(paths: string[], path: string, effect: Effect.Effect<A, E>) {
		return Effect.suspend(() => {
			paths.push(path);
			return effect;
		});
	}
	return {
		...fs,
		exists: (path) => track(accesses.checks, path, fs.exists(path)),
		lstat: (path) => track(accesses.checks, path, fs.lstat(path)),
		readDirectory: (path) => track(accesses.scans, path, fs.readDirectory(path)),
		readFileString: (path, encoding) => track(accesses.reads, path, fs.readFileString(path, encoding)),
		realPath: (path) => track(accesses.checks, path, fs.realPath(path)),
		stat: (path) => track(accesses.checks, path, fs.stat(path)),
		watch: (_path, options) => (options?.recursive ? Stream.fromPubSub(accesses.input) : Stream.never),
	};
}
