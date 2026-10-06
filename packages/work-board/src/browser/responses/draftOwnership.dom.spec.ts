import { Window } from "happy-dom";
import { expect, it } from "vitest";
import { draftSession } from "./draftSession.ts";
import { readDrafts } from "./drafts.ts";

it("preserves and persists edits made while an earlier submission completes under a fresh response identity", async () => {
	const window = new Window({ url: "http://127.0.0.1" });
	const storage = window.localStorage;
	const key = `task/${crypto.randomUUID()}`;
	const revision = "a".repeat(64);
	const notices: string[] = [];
	const session = draftSession(key, revision, storage, "drafts", (message) => notices.push(message));
	const pending = session.update({ author: "maintainer", body: "First reply" });
	session.update({ body: "New conditions typed during submission" });
	expect(session.saved(pending)).toBe(false);
	expect(session.current().body).toBe("New conditions typed during submission");
	expect(session.current().id).not.toBe(pending.id);
	expect(readDrafts(storage.getItem("drafts"), session.current().updatedAt).drafts[key]).toEqual(session.current());
	expect(notices).toEqual([]);
	await window.happyDOM.abort();
});
it("isolates in-memory questionnaire drafts and clearing by workspace", async () => {
	const window = new Window({ url: "http://127.0.0.1" });
	const first = draftSession("same/request", "a", window.localStorage, "workspace:first", () => undefined);
	const second = draftSession("same/request", "a", window.localStorage, "workspace:first:second", () => undefined);
	first.update({ answers: [{ prompt: "choice", selected: ["a"], text: "Reason" }], body: "First workspace" });
	second.update({ body: "Second workspace" });
	first.clear();
	expect(draftSession("same/request", "a", window.localStorage, "workspace:first:second", () => undefined).current().body).toBe("Second workspace");
	expect(draftSession("same/request", "a", window.localStorage, "workspace:first", () => undefined).current().body).toBe("");
	await window.happyDOM.abort();
});
