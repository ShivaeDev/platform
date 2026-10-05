import { renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { changesUntil, type EventStream, type Folder, folder, type RunningBoard, startBoard, subscribe } from "#test/board.ts";
import { faultyWatch } from "#test/faults.ts";

let workspace: Folder;
let reference: Folder;
let replacement: Folder;
let board: RunningBoard;

beforeEach(async () => {
	workspace = folder({ "plan.md": "# Plan\n" });
	reference = folder({
		".drafts/private.md": "# Hidden draft\n",
		"guide/next.md": "# Next reference\n\n[Start](start.md#evidence)\n",
		"guide/start.md": "# Reference guide\n\n[Next](next.md)\n\n## Evidence\n\nReference passage.\n",
		"node_modules/secret.md": "# Dependency\n",
	});
	replacement = folder({ "guide/start.md": "# Replacement guide\n" });
	symlinkSync(reference.root, join(workspace.root, "reference"));
	board = await startBoard(workspace.root, "plan.md");
});

afterEach(async () => {
	await board.stop();
	workspace.remove();
	reference.remove();
	replacement.remove();
});

function get(path: string) {
	return fetch(`${board.url}${path}`);
}

async function ready(events: EventStream) {
	let event = await events.next();
	while (!event.startsWith("event: ready")) {
		event = await events.next();
	}
}

it("reads linked reference Markdown with logical links, search, aliases and cycle protection", async () => {
	await board.stop();
	symlinkSync(reference.root, join(workspace.root, "second-reference"));
	symlinkSync(reference.root, join(reference.root, "guide/loop"));
	symlinkSync(workspace.root, join(reference.root, "workspace-loop"));
	symlinkSync("missing-folder", join(workspace.root, "broken"));
	board = await startBoard(workspace.root, "plan.md");
	const html = await (await get("/reference/guide/start.md")).text();
	expect(html).toContain("Reference guide");
	expect(html).toContain('href="/reference/guide/next.md"');
	expect(html).toContain('href="/second-reference/guide/start.md"');
	expect(html).not.toContain("/loop/");
	expect(html).not.toContain("workspace-loop/");
	expect(html).not.toContain("private.md");
	expect(html).not.toContain("secret.md");
	for (const path of [
		"/reference/.drafts/private.md",
		"/reference/node_modules/secret.md",
		"/reference/guide/loop/guide/start.md",
		"/reference/../guide/start.md",
	]) {
		expect((await get(path)).status).toBe(404);
	}
	const search = await (await get("/_board/search?q=Reference%20passage")).text();
	expect(search).toContain("reference/guide/start.md");
	expect(search).toContain("second-reference/guide/start.md");
});

it("selects the requested linked nested home at / and resolves its relative links", async () => {
	await board.stop();
	symlinkSync(reference.root, join(workspace.root, "a-reference"));
	board = await startBoard(workspace.root, "reference/guide/start.md");
	const html = await (await get("/")).text();
	expect(html).toContain('href="/reference/guide/start.md" aria-current="page"');
	expect(html).toContain('href="/reference/guide/next.md"');
	expect(html).not.toContain('href="/a-reference/guide/start.md" aria-current="page"');
});

it("watches external edits, additions, renames and removals using workspace-relative paths", async () => {
	const events = await subscribe(board);
	try {
		await ready(events);
		await get("/_board/search?q=Reference%20passage");
		reference.write("guide/start.md", "# Reference guide\n\nUpdated linked passage.\n");
		await changesUntil(events, "reference/guide/start.md");
		expect(await (await get("/reference/guide/start.md")).text()).toContain("Updated linked passage");
		expect(await (await get("/_board/search?q=Updated%20linked%20passage")).text()).toContain("reference/guide/start.md");
		expect((await (await get("/_board/search?q=Reference%20passage")).json()).total).toBe(0);
		reference.write("guide/added.md", "# Added reference\n");
		await changesUntil(events, "reference/guide/added.md");
		expect((await get("/reference/guide/added.md")).status).toBe(200);
		renameSync(join(reference.root, "guide/added.md"), join(reference.root, "guide/moved.md"));
		await changesUntil(events, "reference/guide/moved.md");
		expect((await get("/reference/guide/added.md")).status).toBe(404);
		expect((await get("/reference/guide/moved.md")).status).toBe(200);
		rmSync(join(reference.root, "guide/moved.md"));
		await changesUntil(events, "reference/guide/moved.md");
		expect((await get("/reference/guide/moved.md")).status).toBe(404);
	} finally {
		events.close();
	}
});

it("discovers newly linked folders and retargeted links without restarting the server", async () => {
	const events = await subscribe(board);
	try {
		await ready(events);
		symlinkSync(replacement.root, join(workspace.root, "new-reference"));
		await ready(events);
		expect(await (await get("/new-reference/guide/start.md")).text()).toContain("Replacement guide");
		replacement.write("guide/start.md", "# New live replacement\n");
		await changesUntil(events, "new-reference/guide/start.md");
		rmSync(join(workspace.root, "reference"));
		symlinkSync(replacement.root, join(workspace.root, "reference"));
		await ready(events);
		expect(await (await get("/reference/guide/start.md")).text()).toContain("New live replacement");
		expect((await get("/reference/guide/next.md")).status).toBe(404);
		replacement.write("guide/start.md", "# Retargeted live reference\n");
		await changesUntil(events, "reference/guide/start.md");
		expect(await (await get("/_board/search?q=Retargeted%20live%20reference")).text()).toContain("reference/guide/start.md");
	} finally {
		events.close();
	}
});

it("keeps escaping file links outside an explicitly included reference directory unreadable", async () => {
	await board.stop();
	symlinkSync(join(replacement.root, "guide/start.md"), join(reference.root, "guide/leak.md"));
	board = await startBoard(workspace.root, "plan.md");
	expect((await get("/reference/guide/leak.md")).status).toBe(404);
	expect(await (await get("/")).text()).not.toContain("leak.md");
	expect((await (await get("/_board/search?q=Replacement%20guide")).json()).total).toBe(0);
});

it("discloses a failed linked watch and catches up its index after recovery", async () => {
	await board.stop();
	const fault = faultyWatch();
	board = await startBoard(workspace.root, "plan.md", fault.wrap);
	const events = await subscribe(board);
	try {
		await ready(events);
		await get("/_board/search?q=Reference%20passage");
		fault.fail();
		let event = await events.next();
		while (!event.startsWith("event: down")) {
			event = await events.next();
		}
		reference.write("guide/start.md", "# Updated while watching unavailable\n");
		expect((await (await get("/_board/search?q=watching%20unavailable")).json()).total).toBeGreaterThan(0);
		fault.heal();
		await ready(events);
		expect((await (await get("/_board/search?q=Reference%20passage")).json()).total).toBe(0);
	} finally {
		events.close();
	}
});

it("retains internal directory aliases alongside their original paths and watches their retargeting", async () => {
	await board.stop();
	rmSync(join(workspace.root, "reference"));
	workspace.write("notes/start.md", "# Original internal note\n");
	workspace.write("other/start.md", "# Other internal note\n");
	symlinkSync("notes", join(workspace.root, "alias"));
	board = await startBoard(workspace.root, "plan.md");
	const html = await (await get("/")).text();
	expect(html).toContain('href="/notes/start.md"');
	expect(html).toContain('href="/alias/start.md"');
	const events = await subscribe(board);
	try {
		await ready(events);
		rmSync(join(workspace.root, "alias"));
		symlinkSync("other", join(workspace.root, "alias"));
		await ready(events);
		expect(await (await get("/alias/start.md")).text()).toContain("Other internal note");
		workspace.write("other/start.md", "# Updated internal note\n");
		await changesUntil(events, "alias/start.md");
		expect(await (await get("/alias/start.md")).text()).toContain("Updated internal note");
	} finally {
		events.close();
	}
});
