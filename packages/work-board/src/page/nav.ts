import type { MarkdownFile } from "#files/list.ts";
import { fileUrl } from "#files/url.ts";
import { escapeHtml } from "./escape.ts";

function nameOf(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/u, "");
}

function folderOf(path: string): string {
	return path.slice(0, Math.max(0, path.lastIndexOf("/")));
}

function link(file: MarkdownFile, current: string): string {
	const here = file.path === current ? ' aria-current="page"' : "";
	const age = `<span class="age short" data-modified="${file.modified}"></span>`;
	return `<a href="${fileUrl(file.path)}"${here}>${escapeHtml(nameOf(file.path))}</a>${age}`;
}

function folder(name: string, files: readonly MarkdownFile[], current: string): string {
	const links = files.map((file) => `<li>${link(file, current)}</li>`).join("");
	const open = files.some((file) => file.path === current) ? " open" : "";
	return `<details data-key="folder:${escapeHtml(name)}"${open}><summary>${escapeHtml(name)}/ (${files.length})</summary><ul>${links}</ul></details>`;
}

export const navHtml = (files: readonly MarkdownFile[], current: string, home: string | undefined): string => {
	const ordered = [...files.filter((file) => file.path === home), ...files.filter((file) => file.path !== home)];
	const folders = Map.groupBy(ordered, (file) => (file.path === home ? "" : folderOf(file.path)));
	return [...folders]
		.map(([name, grouped]) =>
			name === "" ? `<ul>${grouped.map((file) => `<li>${link(file, current)}</li>`).join("")}</ul>` : folder(name, grouped, current),
		)
		.join("");
};
