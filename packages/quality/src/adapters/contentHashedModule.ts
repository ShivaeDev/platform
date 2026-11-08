import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// Node caches a loaded module by URL, so an edited file only reloads under a URL its content changes.
export function contentHashedModule(path: string, text: string): string {
	const url = pathToFileURL(path);
	url.searchParams.set("content", createHash("sha256").update(text).digest("hex"));
	return url.href;
}
