import type { MarkdownFile } from "../files/list.ts";
import { escapeHtml } from "./escape.ts";

const nameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/u, "");

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const hrefOf = (path: string): string => `/${path.split("/").map(encodeURIComponent).join("/")}`;

const link = (file: MarkdownFile, current: string): string => {
	const here = file.path === current ? ' aria-current="page"' : "";
	const age = `<span class="age short" data-modified="${file.modified}"></span>`;
	return `<a href="${hrefOf(file.path)}"${here}>${escapeHtml(nameOf(file.path))}</a>${age}`;
};

const folder = (name: string, files: ReadonlyArray<MarkdownFile>, current: string): string => {
	const links = files.map((file) => `<li>${link(file, current)}</li>`).join("");
	const open = files.some((file) => file.path === current) ? " open" : "";
	return `<details data-key="folder:${escapeHtml(name)}"${open}><summary>${escapeHtml(name)}/ (${files.length})</summary><ul>${links}</ul></details>`;
};

export const navHtml = (files: ReadonlyArray<MarkdownFile>, current: string, home: string | undefined): string => {
	const ordered = [...files.filter((file) => file.path === home), ...files.filter((file) => file.path !== home)];
	const folders = Map.groupBy(ordered, (file) => (file.path === home ? "" : folderOf(file.path)));
	return [...folders]
		.map(([name, grouped]) => (name === "" ? grouped.map((file) => `<span>${link(file, current)}</span>`).join("") : folder(name, grouped, current)))
		.join("");
};
