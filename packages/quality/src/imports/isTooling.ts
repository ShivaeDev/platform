import { posix } from "node:path";

const TOOL_FOLDERS = new Set(["script", "scripts", "tooling"]);

const CONFIG_FILE = /(?:^|\.)config\.[cm]?[jt]sx?$/u;

export function isTooling(directory: string, path: string): boolean {
	const local = posix.relative(directory, path);
	const [folder = ""] = local.split("/");
	return TOOL_FOLDERS.has(folder) || (!local.includes("/") && CONFIG_FILE.test(local));
}
