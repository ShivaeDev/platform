import { posix } from "node:path";

export function inAdapters(path: string): boolean {
	return posix.dirname(path.replaceAll("\\", "/")).split("/").includes("adapters");
}
