import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { folder } from "./board.ts";

export function searchPrivacyFixture() {
	const outside = folder({ "outside.md": "# Outside secret" });
	const notes = folder({ ".hidden.md": "# Hidden secret", "note.md": "# Visible", "unreadable.md": "# Unreadable secret" });
	symlinkSync(join(outside.root, "outside.md"), join(notes.root, "escape.md"));
	return { notes, outside };
}
