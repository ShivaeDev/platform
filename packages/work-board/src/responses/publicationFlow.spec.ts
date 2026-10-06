import { constants } from "node:fs";
import { chmod, open, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { type Folder, folder } from "#test/board.ts";
import { responseDirectory, responseLink } from "#test/responseFiles.ts";
import { publish } from "./publish.ts";
import { publishIn } from "./publishIn.ts";

let notes: Folder;
let outside: Folder;
afterEach(() => {
	notes?.remove();
	outside?.remove();
	vi.restoreAllMocks();
});
it("never replaces a conflicting file or follows a destination symlink", async () => {
	notes = folder({ "responses/response.a.md": "Other contribution" });
	outside = folder({ "reference.md": "Outside source" });
	await expect(Effect.runPromise(publish(notes.root, notes.root, "response.a", "New feedback"))).rejects.toThrow("different content");
	expect(await readFile(join(notes.root, "responses/response.a.md"), "utf8")).toBe("Other contribution");
	responseLink(notes.root, "response.link.md", join(outside.root, "reference.md"));
	await expect(Effect.runPromise(publish(notes.root, notes.root, "response.link", "New feedback"))).rejects.toThrow();
	expect(await readFile(join(outside.root, "reference.md"), "utf8")).toBe("Outside source");
	expect((await readdir(join(notes.root, "responses"))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
});
it("reports uncertainty after publication fails directory synchronization and safely reconciles the already-published identity", async () => {
	notes = folder({});
	responseDirectory(notes.root);
	const target = await open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY);
	try {
		const fault = vi.spyOn(target, "sync").mockRejectedValueOnce(new Error("disk synchronization failed"));
		await expect(publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback")).rejects.toMatchObject({ code: "Uncertain" });
		expect(await readFile(join(notes.root, "responses/response.a.md"), "utf8")).toBe("Recorded feedback");
		fault.mockRejectedValueOnce(new Error("reconciliation synchronization failed"));
		await expect(publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback")).rejects.toMatchObject({ code: "Uncertain" });
		fault.mockRestore();
		await publishIn(target, notes.root, notes.root, "response.a", "Recorded feedback");
		expect(await readdir(join(notes.root, "responses"))).toEqual(["response.a.md"]);
	} finally {
		await target.close();
	}
});
it("rejects permission failure before publication and cleans temporary files", async () => {
	notes = folder({});
	responseDirectory(notes.root);
	await chmod(join(notes.root, "responses"), 0o500);
	try {
		await expect(Effect.runPromise(publish(notes.root, notes.root, "response.a", "Feedback"))).rejects.toThrow("could not be recorded");
		expect(await readdir(join(notes.root, "responses"))).toEqual([]);
	} finally {
		await chmod(join(notes.root, "responses"), 0o700);
	}
});
