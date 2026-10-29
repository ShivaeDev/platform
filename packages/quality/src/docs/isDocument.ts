import { posix } from "node:path";

// Released changelogs keep the links and commands of their release, so a later change does not rewrite history.
export function isDocument(path: string): boolean {
	return path.endsWith(".md") && posix.basename(path) !== "CHANGELOG.md";
}
