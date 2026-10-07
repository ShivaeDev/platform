import { fork } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { type Folder, folder } from "#test/board.ts";
import { publish } from "./publish.ts";

let notes: Folder;
afterEach(() => notes?.remove());

it.each(["temporary", "published"])("recovers after killing a writer with a %s file on the real filesystem", async (phase) => {
	notes = folder({});
	const child = fork(new URL("../test-support/publicationChild.ts", import.meta.url), [notes.root, phase], {
		execArgv: ["--conditions=source"],
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});
	const exited = once(child, "exit");
	let diagnostics = "";
	child.stderr?.on("data", (chunk) => {
		diagnostics += String(chunk);
	});
	try {
		const reached = await Promise.race([once(child, "message").then(([message]) => message), exited.then(() => diagnostics)]);
		expect(reached).toBe(phase);
	} finally {
		child.kill("SIGKILL");
		await exited;
	}
	const files = await readdir(join(notes.root, "responses"));
	expect(files.filter((name) => name.endsWith(".tmp"))).toHaveLength(1);
	expect(files.includes("response.interrupted.md")).toBe(phase === "published");
	await Effect.runPromise(publish(notes.root, notes.root, "response.interrupted", "Retained feedback"));
	expect(await readFile(join(notes.root, "responses/response.interrupted.md"), "utf8")).toBe("Retained feedback");
	await expect(Effect.runPromise(publish(notes.root, notes.root, "response.interrupted", "Conflicting feedback"))).rejects.toThrow(
		"different content",
	);
	expect(await readFile(join(notes.root, "responses/response.interrupted.md"), "utf8")).toBe("Retained feedback");
});
