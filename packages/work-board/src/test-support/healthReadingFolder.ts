import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { folder } from "./board.ts";
import { health } from "./diagnostics.ts";

export function healthReadingFolder(trait: "outside-directory" | "file-link" | "directory-file" | "oversized") {
	const notes = folder({});
	const outside = folder({ "fleet/health.json": JSON.stringify(health) });
	switch (trait) {
		case "outside-directory":
			symlinkSync(join(outside.root, "fleet"), join(notes.root, "fleet"));
			break;
		case "file-link":
			mkdirSync(join(notes.root, "fleet"));
			symlinkSync(join(outside.root, "fleet/health.json"), join(notes.root, "fleet/health.json"));
			break;
		case "directory-file":
			mkdirSync(join(notes.root, "fleet/health.json"), { recursive: true });
			break;
		case "oversized":
			mkdirSync(join(notes.root, "fleet"));
			writeFileSync(join(notes.root, "fleet/health.json"), "x".repeat(65 * 1024));
	}
	return {
		...notes,
		remove: () => {
			notes.remove();
			outside.remove();
		},
	};
}
