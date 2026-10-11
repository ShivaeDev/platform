import { fleetRecords, inboxItems } from "#attention/inbox.ts";
import { type Navigation, type NavigationFile, NavigationFolder } from "#browser/navigation/schema.ts";
import type { MarkdownFile } from "#files/list.ts";
import { fileUrl } from "#files/url.ts";
import type { Snapshot } from "#search/snapshot.ts";

export function inboxCount(snapshot?: Snapshot): number | null {
	return !snapshot || snapshot.unavailable.length > 0 ? null : inboxItems(snapshot).length;
}

function fileData(file: MarkdownFile, current: string): NavigationFile {
	return {
		current: file.path === current,
		href: fileUrl(file.path),
		modified: file.modified,
		name: file.path.slice(file.path.lastIndexOf("/") + 1).replace(/\.md$/u, ""),
		path: file.path,
	};
}

interface Branch {
	active: boolean;
	count: number;
	readonly files: NavigationFile[];
	readonly folders: Map<string, Branch>;
	readonly name: string;
	readonly path: string;
}

function branch(path: string, name: string): Branch {
	return { active: false, count: 0, files: [], folders: new Map(), name, path };
}

function folderData(folder: Branch): NavigationFolder {
	return new NavigationFolder({
		...folder,
		folders: [...folder.folders].sort(([left], [right]) => left.localeCompare(right)).map(([, child]) => folderData(child)),
	});
}

export function navigationData(files: readonly MarkdownFile[], current: string, home: string | undefined, snapshot?: Snapshot): Navigation {
	const generated = snapshot ? fleetRecords(snapshot.model) : new Set<string>();
	const records = files.filter((file) => generated.has(file.path)).map((file) => fileData(file, current));
	const visible = files.filter((file) => !generated.has(file.path));
	const root = branch("", "");
	const ordered = [
		...visible.filter((file) => file.path === home),
		...visible.filter((file) => file.path !== home).toSorted((left, right) => left.path.localeCompare(right.path)),
	];
	for (const file of ordered) {
		let parent = root;
		parent.count += 1;
		parent.active ||= file.path === current;
		const parts = file.path === home ? [] : file.path.split("/").slice(0, -1);
		for (const name of parts) {
			let child = parent.folders.get(name);
			if (child === undefined) {
				child = branch(parent.path === "" ? name : `${parent.path}/${name}`, name);
				parent.folders.set(name, child);
			}
			child.count += 1;
			child.active ||= file.path === current;
			parent = child;
		}
		parent.files.push(fileData(file, current));
	}
	return {
		inboxCount: inboxCount(snapshot),
		records: { active: records.some((file) => file.current), count: records.length, files: records },
		tree: folderData(root),
	};
}
