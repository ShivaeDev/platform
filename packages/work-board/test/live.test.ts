import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changesUntil, type EventStream, type Folder, folder, type RunningBoard, startBoard, subscribe } from "./support/board.ts";
import { faultyWatch } from "./support/faults.ts";

let notes: Folder;
let board: RunningBoard;

beforeEach(async () => {
	notes = folder({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n", "notes/log.md": "# Log\n" });
	board = await startBoard(notes.root, "plan.md");
});

afterEach(async () => {
	await board.stop();
	notes.remove();
});

const ready = async () => {
	const events = await subscribe(board);
	expect(await events.next()).toBe("event: ready\ndata: ");
	return events;
};

describe("live updates", () => {
	it("pushes a change event naming the markdown file that was written", async () => {
		const events = await ready();
		notes.write("notes/log.md", "# Log\n\nA new line.\n");
		expect((await changesUntil(events, "notes/log.md")).at(-1)).toContain("notes/log.md");
		events.close();
	});

	it("never names a file that is not markdown", async () => {
		const events = await ready();
		notes.write("notes/raw.txt", "plain\n");
		notes.write("plan.md", "# Plan\n");
		expect((await changesUntil(events, "plan.md")).flat()).not.toContain("notes/raw.txt");
		events.close();
	});

	it("settles changes that land together into one event", async () => {
		const events = await ready();
		notes.write("notes/log.md", "# Log\n\nOne.\n");
		notes.write("plan.md", "# Plan\n\nTwo.\n");
		const seen = await changesUntil(events, "plan.md");
		expect(seen.at(-1)).toEqual(expect.arrayContaining(["notes/log.md", "plan.md"]));
		events.close();
	});

	it("serves and announces a file in a new folder without a restart", async () => {
		const events = await ready();
		notes.write("later/idea.md", "# Idea\n");
		expect((await changesUntil(events, "later/idea.md")).at(-1)).toContain("later/idea.md");
		const page = await (await fetch(`${board.url}/later/idea.md`)).text();
		expect(page).toContain('<article class="doc"><h1>Idea</h1>');
		expect(page).toContain('<a href="/later/idea.md" aria-current="page">idea</a>');
		events.close();
	});

	it("shows an edit on the next request without a rebuild", async () => {
		notes.write("plan.md", "# Plan\n\n## To do\n\n### One\n\n### Two\n");
		expect(await (await fetch(board.url)).text()).toContain("<span><b>2</b> to do</span>");
	});
});

const nextNamed = async (events: EventStream, name: string) => {
	for (let event = await events.next(); ; event = await events.next()) {
		if (event.startsWith(`event: ${name}\n`)) {
			return event;
		}
	}
};

describe("watcher recovery", () => {
	it("says the folder is not watched after the watcher fails, restarts it with backoff and reports changes again", async () => {
		await board.stop();
		const faults = faultyWatch();
		board = await startBoard(notes.root, "plan.md", faults.wrap);
		const events = await ready();
		faults.fail();
		await nextNamed(events, "down");
		const late = await subscribe(board);
		expect(await late.next()).toBe("event: down\ndata: ");
		late.close();
		faults.heal();
		await nextNamed(events, "ready");
		notes.write("notes/log.md", "# Log\n\nAfter the restart.\n");
		expect((await changesUntil(events, "notes/log.md")).at(-1)).toContain("notes/log.md");
		events.close();
	});

	it("waits longer between each restart while the watcher keeps failing", async () => {
		await board.stop();
		const faults = faultyWatch();
		board = await startBoard(notes.root, "plan.md", faults.wrap);
		const events = await ready();
		faults.fail();
		await nextNamed(events, "down");
		await new Promise((resolve) => setTimeout(resolve, 1500));
		events.close();
		const retries = faults.attempts.slice(1);
		const gaps = retries.slice(1).map((at, index) => at - (retries[index] ?? at));
		expect(retries.length).toBeGreaterThanOrEqual(3);
		expect(retries.length).toBeLessThanOrEqual(8);
		expect(gaps.every((gap, index) => gap > (gaps[index - 1] ?? 0))).toBe(true);
	});
});

describe("a folder whose own name starts with a dot", () => {
	let dotted: Folder;
	let dotBoard: RunningBoard;

	beforeEach(async () => {
		dotted = folder({
			".notes/plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
			".notes/notes/log.md": "# Log\n",
			".notes/.hidden/x.md": "# Hidden\n",
			".notes/node_modules/x.md": "# Dependency\n",
		});
		dotBoard = await startBoard(join(dotted.root, ".notes"), "plan.md");
	});

	afterEach(async () => {
		await dotBoard.stop();
		dotted.remove();
	});

	it("lists, serves and watches it, and still skips dot folders and node_modules inside it", async () => {
		const home = await (await fetch(dotBoard.url)).text();
		expect(home).toContain("<span><b>1</b> to do</span>");
		expect(home).toContain('<a href="/notes/log.md">log</a>');
		expect(home).not.toContain(">x<");
		expect(await (await fetch(`${dotBoard.url}/notes/log.md`)).text()).toContain('<article class="doc"><h1>Log</h1>');
		expect((await fetch(`${dotBoard.url}/.hidden/x.md`)).status).toBe(404);
		expect((await fetch(`${dotBoard.url}/node_modules/x.md`)).status).toBe(404);
		const events = await subscribe(dotBoard);
		expect(await events.next()).toBe("event: ready\ndata: ");
		dotted.write(".notes/.hidden/x.md", "# Hidden, edited\n");
		dotted.write(".notes/notes/log.md", "# Log\n\nEdited.\n");
		const seen = await changesUntil(events, "notes/log.md");
		expect(seen.flat()).not.toContain(".hidden/x.md");
		events.close();
	});
});
