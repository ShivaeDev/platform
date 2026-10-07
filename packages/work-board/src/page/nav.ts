import type { MarkdownFile } from "#files/list.ts";
import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "./escape.ts";

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/u, "");
}

function link(file: MarkdownFile, current: string): string {
	const here = file.path === current ? ' aria-current="page"' : "";
	const age = `<span class="age short" data-modified="${file.modified}"></span>`;
	return `<a href="${fileUrl(file.path)}"${here}>${escapeHtml(nameOf(file.path))}</a>${age}`;
}

interface Folder {
	active: boolean;
	count: number;
	readonly files: MarkdownFile[];
	readonly folders: Map<string, Folder>;
	readonly path: string;
}

function branch(path: string): Folder {
	return { active: false, count: 0, files: [], folders: new Map(), path };
}

function contents(folder: Folder, current: string): string {
	const files = folder.files.map((file) => `<li>${link(file, current)}</li>`).join("");
	const folders = [...folder.folders]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, child]) => {
			const open = child.active ? " open" : "";
			return `<li class="file-folder"><details data-key="folder:${escapeHtml(child.path)}"${open}><summary>${escapeHtml(name)}/ (${child.count})</summary>${contents(child, current)}</details></li>`;
		})
		.join("");
	return `<ul>${files}${folders}</ul>`;
}

export function navHtml(files: readonly MarkdownFile[], current: string, home: string | undefined): string {
	const root = branch("");
	const ordered = [
		...files.filter((file) => file.path === home),
		...files.filter((file) => file.path !== home).toSorted((left, right) => left.path.localeCompare(right.path)),
	];
	for (const file of ordered) {
		let parent = root;
		const parts = file.path === home ? [] : file.path.split("/").slice(0, -1);
		for (const name of parts) {
			let child = parent.folders.get(name);
			if (child === undefined) {
				child = branch(parent.path === "" ? name : `${parent.path}/${name}`);
				parent.folders.set(name, child);
			}
			child.count += 1;
			child.active ||= file.path === current;
			parent = child;
		}
		parent.files.push(file);
	}
	return contents(root, current);
}
