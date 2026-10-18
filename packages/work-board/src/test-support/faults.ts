import { Deferred, Effect, PlatformError, Stream } from "effect";
import type { FileSystemWrapper } from "./board.ts";

export interface FaultyWatch {
	readonly attempts: readonly number[];
	readonly fail: () => Effect.Effect<void>;
	readonly heal: () => void;
	readonly wrap: FileSystemWrapper;
}

const injected = PlatformError.systemError({ _tag: "Unknown", description: "Injected watcher failure", method: "watch", module: "FileSystem" });

export function faultyWatch(): FaultyWatch {
	let broken = false;
	const attempts: number[] = [];
	let failure = Deferred.makeUnsafe<void>();
	const wrap: FileSystemWrapper = (fs) => ({
		...fs,
		watch: (path, options) =>
			Stream.suspend(() => {
				if (options?.recursive) {
					attempts.push(performance.now());
				}
				if (broken) {
					return Stream.fail(injected);
				}
				failure = Deferred.makeUnsafe<void>();
				return Stream.merge(
					fs.watch(path, options),
					Stream.flatMap(Stream.fromEffect(Deferred.await(failure)), () => Stream.fail(injected)),
				);
			}),
	});
	function fail() {
		return Effect.sync(() => {
			broken = true;
		}).pipe(Effect.andThen(Effect.suspend(() => Deferred.succeed(failure, undefined))));
	}
	return {
		attempts,
		fail,
		heal: () => {
			broken = false;
			return broken;
		},
		wrap,
	};
}

export const silentWatch: FileSystemWrapper = (fs) => ({ ...fs, watch: () => Stream.never });

export function countingPaths(): { readonly wrap: FileSystemWrapper; readonly visited: readonly string[]; readonly listed: readonly string[] } {
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
}
