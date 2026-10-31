import { type FileSystem, Stream } from "effect";
import { isWatchSentinel } from "#server/files/watchSentinel.ts";

// A fake watcher still forwards the board's own sentinel from the real one, so the board starts watching as it does on a live watch.
export function readinessEvents(fs: FileSystem.FileSystem, path: string, options?: FileSystem.WatchOptions) {
	return fs.watch(path, options).pipe(Stream.filter((event) => isWatchSentinel(event.path)));
}
