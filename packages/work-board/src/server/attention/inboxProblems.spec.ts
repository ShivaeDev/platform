import { expect, it } from "vitest";
import { navHtml } from "#server/page/nav.ts";
import { projectItems } from "#server/views/projection.ts";
import { stateOf } from "#server/views/state.ts";
import { workCards } from "#server/views/workCards.ts";
import { inboxFixture, inboxSnapshot } from "#test/inboxFixture.ts";
import { inboxItems } from "./inbox.ts";
import { inboxHtml } from "./inboxHtml.ts";
import { overviewHtml } from "./overviewHtml.ts";

it("discloses missing and duplicated IDs, links each source, and labels non-Fleet waiting work honestly", () => {
	const snapshot = inboxSnapshot({
		"first.md": "---\nid: work.review\nstatus: needs-human\nowner: codex\n---\n# First source",
		"missing.md": "---\nkind: task\nowner: Casey\nnext_action: Review evidence\n---\n# Missing identity",
		"second.md": "---\nid: work.review\nstatus: needs-human\nowner: Casey\n---\n# Second source",
	});
	expect(inboxItems(snapshot)).toHaveLength(3);
	const html = inboxHtml(snapshot);
	expect(html).toContain("Missing or invalid item ID");
	expect(html.match(/Duplicate item ID: work.review/gu)).toHaveLength(2);
	for (const file of ["missing.md", "first.md", "second.md"]) {
		expect(html).toContain(`href="/${file}"`);
	}
	expect(html).toContain("Needs a person: Review the blocked work");
	expect(html).not.toContain("Fleet");
});

it("keeps waiting cards in their recorded status columns and shows only a linked Inbox summary in Overview", () => {
	const snapshot = inboxSnapshot();
	const state = stateOf("/_board/work?view=board");
	const waiting = new Map(inboxItems(snapshot).map((item) => [item.id, item.reason]));
	const cards = workCards(projectItems(snapshot, state).rows, state, waiting);
	expect(cards).toContain('aria-label="planned"');
	expect(cards).toContain('aria-label="needs-human"');
	expect(cards).not.toContain('aria-label="Waiting on you"');
	expect(cards).toContain('data-status-token="needs-you"');
	expect(cards.match(/data-status-token=/gu)).toHaveLength(3);
	expect(cards).not.toContain("Not recorded");
	const overview = overviewHtml(snapshot);
	expect(overview).toContain("3 waiting");
	expect(overview).toContain('href="/_board/inbox">Open Inbox');
	expect(overview).not.toContain('class="inbox-row"');
});

it("shows days beyond 48 hours without JavaScript and withholds the count when indexing is unavailable", () => {
	const snapshot = inboxSnapshot(inboxFixture());
	expect(inboxHtml(snapshot, false, 3 * 24 * 60 * 60 * 1000)).toContain("updated 3d ago");
	for (const unavailable of [undefined, inboxSnapshot(inboxFixture(), ["unreadable.md"])]) {
		expect(navHtml([], "", undefined, unavailable)).toContain('data-inbox-count="?"');
	}
});
