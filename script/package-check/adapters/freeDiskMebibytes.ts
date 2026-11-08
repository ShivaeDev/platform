import { statfs } from "node:fs/promises";
import { Effect } from "effect";

export function freeDiskMebibytes(path: string) {
	return Effect.promise(() => statfs(path)).pipe(Effect.map(({ bavail, bsize }) => Math.floor((bavail * bsize) / 1024 ** 2)));
}
