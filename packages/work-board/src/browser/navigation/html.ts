import { escapeHtml } from "#browser/escapeHtml.ts";
import type { Navigation, NavigationFile, NavigationFolder } from "./schema.ts";

function link(file: NavigationFile): string {
	const here = file.current ? ' aria-current="page"' : "";
	const age = `<span class="age short" data-modified="${file.modified}"></span>`;
	return `<a href="${file.href}"${here}>${escapeHtml(file.name)}</a>${age}`;
}

function contents(folder: NavigationFolder, count?: string): string {
	const files = folder.files.map((file) => `<li>${link(file)}</li>`).join("");
	const folders = folder.folders
		.map((child) => {
			const open = child.active ? " open" : "";
			return `<li class="file-folder"><details data-key="folder:${escapeHtml(child.path)}"${open}><summary>${escapeHtml(child.name)}/ (${child.count})</summary>${contents(child)}</details></li>`;
		})
		.join("");
	return `<ul${count === undefined ? "" : ` data-inbox-count="${count}"`}>${files}${folders}</ul>`;
}

export function navigationHtml(data: Navigation): string {
	const records = data.records;
	const open = records.active ? " open" : "";
	const fleet =
		records.count === 0
			? ""
			: `<details data-key="fleet-records"${open}><summary>Fleet records (${records.count})</summary><ul>${records.files.map((file) => `<li>${link(file)}</li>`).join("")}</ul></details>`;
	return contents(data.tree, String(data.inboxCount ?? "?")) + fleet;
}
