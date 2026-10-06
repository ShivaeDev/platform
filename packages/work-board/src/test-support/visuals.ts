import { symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folder, startBoard } from "./board.ts";
import type { OpenPage } from "./browser.ts";

export const SCREENSHOT = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8V8AAAAASUVORK5CYII=", "base64");

export async function visualWorkspace() {
	const notes = folder({
		"nested/home.md":
			"# Visual review\n\n![First screenshot](../shots/first%20%26%20review.png)\n\n![Second screenshot](../shots/second.png)\n\n![Missing screenshot](../shots/missing%ZZ.png)\n\n```mermaid\ngraph TD; A-->B\n```\n\n[Open reference](../shots/second.png)\n\n[Result](result.md)\n\nReading context.\n",
		"nested/result.md":
			"---\nid: result.visual\nevidence:\n  - source: '../shots/first%20%26%20review.png'\n    checked_revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'\n    observed_at: '2026-10-06T00:00:00Z'\n---\n# Result\n",
		"shots/a.constructor": "private",
		"shots/evil.svg": "<svg xmlns='http://www.w3.org/2000/svg'><script>alert('private')</script></svg>",
		"shots/first & review.png": "",
		"shots/second.png": "",
	});
	const outside = folder({ "outside.png": "private" });
	writeFileSync(join(notes.root, "shots/first & review.png"), SCREENSHOT);
	writeFileSync(join(notes.root, "shots/second.png"), SCREENSHOT);
	const board = await startBoard(notes.root, "nested/home.md");
	return {
		board,
		get: (path: string) => fetch(`${board.url}${path}`),
		outsideLinks: () => {
			symlinkSync(join(outside.root, "outside.png"), join(notes.root, "shots/leak.png"));
			symlinkSync(outside.root, join(notes.root, "reference"));
		},
		oversize: () => truncateSync(join(notes.root, "shots/second.png"), 16 * 1024 * 1024 + 1),
		replaceImage: () => writeFileSync(join(notes.root, "shots/second.png"), Buffer.concat([SCREENSHOT, Buffer.from("Updated")])),
		stop: async () => {
			await board.stop();
			notes.remove();
			outside.remove();
		},
	};
}

export function diagramDownloads(page: OpenPage) {
	const url = page.window.URL;
	const create = url.createObjectURL;
	const revoke = url.revokeObjectURL;
	const types: string[] = [];
	const released: string[] = [];
	Object.assign(url, {
		"createObjectURL": (blob: { readonly type: string }) => {
			types.push(blob.type);
			return "blob:local-diagram";
		},
		"revokeObjectURL": (href: string) => released.push(href),
	});
	return {
		released,
		restore: () => Object.assign(url, { "createObjectURL": create, "revokeObjectURL": revoke }),
		types,
	};
}
