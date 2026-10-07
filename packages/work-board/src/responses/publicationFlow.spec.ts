import { constants } from "node:fs";
import { chmod, open, readdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { type Folder, folder } from "#test/board.ts";
import { outsideResponseDirectory, responseDirectory, responseLink } from "#test/responseFiles.ts";
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

it("concurrent writers publish one winner and reconcile only identical content", async () => {
	notes = folder({});
	const attempts = await Promise.allSettled(
		["First feedback", "Other feedback"].map((content) => Effect.runPromise(publish(notes.root, notes.root, "response.race", content))),
	);
	expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
	const saved = await readFile(join(notes.root, "responses/response.race.md"), "utf8");
	await Promise.all(Array.from({ length: 4 }, () => Effect.runPromise(publish(notes.root, notes.root, "response.race", saved))));
	expect(await readdir(join(notes.root, "responses"))).toEqual(["response.race.md"]);
});
it("rejects a replaced directory before publication and reports uncertainty after publication", async () => {
	notes = folder({});
	outside = folder({});
	responseDirectory(notes.root);
	const target = await open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		const sync = target.sync.bind(target);
		vi.spyOn(target, "sync").mockImplementationOnce(async () => {
			await sync();
			await rename(join(notes.root, "responses"), join(notes.root, "retained"));
			outsideResponseDirectory(notes.root, outside.root);
		});
		await expect(publishIn(target, notes.root, notes.root, "response.boundary", "Retained feedback")).rejects.toMatchObject({ code: "Uncertain" });
		expect(await readFile(join(notes.root, "retained/response.boundary.md"), "utf8")).toBe("Retained feedback");
		await expect(publishIn(target, notes.root, notes.root, "response.other", "Other feedback")).rejects.toMatchObject({ code: "Conflict" });
		expect(await readdir(outside.root)).toEqual([]);
	} finally {
		await target.close();
	}
});

it("reports a boundary change detected during cleanup as uncertain without cleaning another directory", async () => {
	notes = folder({});
	outside = folder({});
	responseDirectory(notes.root);
	const target = await open(join(notes.root, "responses"), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		const stat = target.stat.bind(target);
		let checks = 0;
		vi.spyOn(target, "stat").mockImplementation(async () => {
			checks += 1;
			if (checks === 4) {
				await rename(join(notes.root, "responses"), join(notes.root, "retained"));
				outsideResponseDirectory(notes.root, outside.root);
			}
			return stat();
		});
		await expect(publishIn(target, notes.root, notes.root, "response.cleanup", "Retained feedback")).rejects.toMatchObject({ code: "Uncertain" });
		expect(await readFile(join(notes.root, "retained/response.cleanup.md"), "utf8")).toBe("Retained feedback");
		expect(await readdir(outside.root)).toEqual([]);
	} finally {
		await target.close();
	}
});
