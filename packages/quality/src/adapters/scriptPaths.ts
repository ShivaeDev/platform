import { posix } from "node:path";

export function scriptPaths(directory: string, scripts: Readonly<Record<string, string>>): readonly string[] {
	return Object.values(scripts).flatMap((script) => script.split(/[\s'"`;|&()]+/u).map((word) => posix.join(directory, word)));
}
