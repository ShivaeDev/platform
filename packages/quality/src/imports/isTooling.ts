import { posix } from "node:path";

const TOOL_FOLDERS = new Set(["script", "scripts", "tooling"]);

const CONFIG_FILE = /(?:^|\.)config\.[cm]?[jt]sx?$/u;

export function isPackageRootConfig(directory: string, path: string): boolean {
	const local = posix.relative(directory, path);
	return !local.includes("/") && CONFIG_FILE.test(local);
}

export function isTooling(directory: string, path: string): boolean {
	const [folder = ""] = posix.relative(directory, path).split("/");
	return TOOL_FOLDERS.has(folder) || isPackageRootConfig(directory, path);
}
