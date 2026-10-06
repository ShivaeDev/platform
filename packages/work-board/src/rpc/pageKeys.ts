import type { Key } from "@shivaedev/effect-contract/keys.ts";
import { documents, identities, index, workspace } from "./keys.ts";

export function pageKeys(url: string): readonly Key[] {
	const path = new URL(url, "http://127.0.0.1").pathname;
	const item = /^\/_board\/item\/(?<id>[^/]+)\/$/u.exec(path)?.groups?.id;
	let key: Key = documents.item(decodeURIComponent(path.slice(1)));
	if (item) {
		key = identities.item(decodeURIComponent(item));
	} else if (path.startsWith("/_board/")) {
		key = index.list;
	}
	return [workspace.list, key];
}
