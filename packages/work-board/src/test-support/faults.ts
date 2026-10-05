import { Deferred, Effect, PlatformError, Stream } from "effect";
import type { FileSystemWrapper } from "./board.ts";

export interface FaultyWatch {
	readonly attempts: readonly number[];
	readonly fail: () => void;
	readonly heal: () => void;
	readonly wrap: FileSystemWrapper;
}

const injected = PlatformError.systemError({ _tag: "Unknown", description: "Injected watcher failure", method: "watch", module: "FileSystem" });

export const faultyWatch = (): FaultyWatch => {
	let broken = false;
	const attempts: number[] = [];
	let failure = Effect.runSync(Deferred.make<void>());
	const wrap: FileSystemWrapper = (fs) => ({
		...fs,
		watch: (path, options) =>
			Stream.suspend(() => {
				attempts.push(performance.now());
				if (broken) {
					return Stream.fail(injected);
				}
				failure = Effect.runSync(Deferred.make<void>());
				return Stream.merge(
					fs.watch(path, options),
					Stream.flatMap(Stream.fromEffect(Deferred.await(failure)), () => Stream.fail(injected)),
				);
			}),
	});
	const fail = () => {
		broken = true;
		Effect.runSync(Deferred.succeed(failure, undefined));
	};
	return { attempts, fail, heal: () => (broken = false), wrap };
};

export const silentWatch: FileSystemWrapper = (fs) => ({ ...fs, watch: () => Stream.never });

export const countingPaths = (): { readonly wrap: FileSystemWrapper; readonly visited: readonly string[]; readonly listed: readonly string[] } => {
	const visited: string[] = [];
	const listed: string[] = [];
	const wrap: FileSystemWrapper = (fs) => ({
		...fs,
		readDirectory: (path, options) => {
			listed.push(path);
			visited.push(path);
			return fs.readDirectory(path, options);
		},
		realPath: (path) => {
			visited.push(path);
			return fs.realPath(path);
		},
		stat: (path) => {
			visited.push(path);
			return fs.stat(path);
		},
	});
	return { listed, visited, wrap };
};
