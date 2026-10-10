import { Clock, Effect } from "effect";
import { expect, it } from "vitest";
import { draftSession } from "#browser/responses/draftSession.ts";
import { DRAFT_AGE, encodeDrafts } from "#browser/responses/drafts.ts";
import { edgeDraft } from "#test/coverageEdges.ts";
import { draftStorage } from "#test/draftStorage.ts";

it("keeps drafts in memory and discloses unavailable browser storage", () => {
	const reports: string[] = [];
	const session = draftSession("q", edgeDraft.revision, undefined, "unavailable-edge", (message) => reports.push(message));
	const edited = session.update({ body: "Retained in this window." });
	expect(session.current()).toBe(edited);
	expect(edited.body).toBe("Retained in this window.");
	expect(reports).toEqual([
		"Draft history is unavailable or malformed. Keep a copy; edits remain in this window.",
		"Draft could not be persisted (storage full or unavailable). Keep a copy; your text remains in this window.",
	]);
});

it("clears expired persisted drafts and discloses the 30-day boundary", () => {
	const key = "expired-edge";
	const external = draftStorage(key, encodeDrafts({ q: { ...edgeDraft, updatedAt: Effect.runSync(Clock.currentTimeMillis) - DRAFT_AGE } }));
	const reports: string[] = [];
	const session = draftSession("q", edgeDraft.revision, external.storage, key, (message) => reports.push(message));
	expect(session.current().body).toBe("");
	expect(external.raw()).toBe("{}");
	expect(reports).toEqual(["Expired drafts were cleared after 30 days. Saved responses are unaffected."]);
});

it("retains reviewed text and explicitly reports a changed source revision", () => {
	const key = "revision-edge";
	const external = draftStorage(key, encodeDrafts({ q: { ...edgeDraft, updatedAt: Effect.runSync(Clock.currentTimeMillis) } }));
	const reports: string[] = [];
	const session = draftSession("q", "b".repeat(64), external.storage, key, (message) => reports.push(message));
	expect(session.current().body).toBe(edgeDraft.body);
	expect(reports).toEqual(["Source changed since this draft. Your text is retained; review the new source and preview to bind it to this revision."]);
});

it("discloses denied draft clearing while retaining the persisted draft", () => {
	const key = "clear-edge";
	const external = draftStorage(key);
	const reports: string[] = [];
	const session = draftSession("q", edgeDraft.revision, external.storage, key, (message) => reports.push(message));
	session.update({ body: edgeDraft.body });
	const persisted = external.raw();
	external.denyWrites();
	session.clear();
	expect(external.raw()).toBe(persisted);
	expect(reports).toEqual(["Draft storage could not be cleared."]);
});

it("discloses failed browser cleanup after a confirmed save while starting a fresh draft", () => {
	const key = "saved-edge";
	const external = draftStorage(key);
	const reports: string[] = [];
	const session = draftSession("q", edgeDraft.revision, external.storage, key, (message) => reports.push(message));
	const pending = session.update({ body: edgeDraft.body });
	external.denyWrites();
	expect(session.saved(pending)).toBe(true);
	expect(session.current()).toMatchObject({ body: "" });
	expect(session.current().id).not.toBe(pending.id);
	expect(reports).toEqual(["Saved response confirmed, but its browser draft could not be cleared."]);
});
