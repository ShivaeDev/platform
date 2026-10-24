import { expect } from "vitest";
import { boardSession, jobBoard } from "#modules/notes/test-support/jobBoard.ts";

const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const UNAUTHORIZED_STATUS = 401;

jobBoard.it("an admin sees an enqueued note job, failures and dead-letter queue", [boardSession("admin")], function* ({ createNote, open }) {
	const note = yield* createNote("Inspect this queued note");
	const home = yield* open("/admin/jobs");
	expect(home.status).toBe(OK_STATUS);
	expect(home.text).toContain("Queues");
	expect(home.assets).not.toEqual([]);
	for (const path of home.assets) {
		const asset = yield* open(path);
		expect(asset.status).toBe(OK_STATUS);
		expect(asset.cacheControl).toBe("private, no-store");
	}
	const queue = yield* open("/admin/jobs/queues/count-note-words");
	expect(queue.status).toBe(OK_STATUS);
	const path = queue.jobs[0];
	expect(path).toBeDefined();
	const detail = yield* open(path ?? "");
	expect(detail.status).toBe(OK_STATUS);
	expect(detail.data).toMatchObject({ payload: { noteId: note.id } });
	expect(detail.text).toContain("created");
	expect((yield* open("/admin/jobs/queues/count-note-words?state=failed")).status).toBe(OK_STATUS);
	const deadLetter = yield* open("/admin/jobs/queues/count-note-words-dlq");
	expect(deadLetter.status).toBe(OK_STATUS);
	expect(deadLetter.text).toContain("count-note-words-dlq");
});

jobBoard.it("deployment cannot enable cancel or delete through the mounted board", [boardSession("admin")], function* ({ createNote, open }) {
	const note = yield* createNote("Keep this job queued");
	const queue = yield* open("/admin/jobs/queues/count-note-words");
	const path = queue.jobs[0];
	expect(path).toBeDefined();
	const before = yield* open(path ?? "");
	expect(before.status).toBe(OK_STATUS);
	expect(before.data).toMatchObject({ payload: { noteId: note.id } });
	for (const intent of ["cancel", "delete", "retry"]) {
		const refused = yield* open(path ?? "", { intent, method: "POST" });
		expect(refused.status).toBe(FORBIDDEN_STATUS);
		expect(refused.text).toContain("read-only");
		const after = yield* open(path ?? "");
		expect(after.status).toBe(OK_STATUS);
		expect(after.data).toEqual(before.data);
		expect(after.text).toContain("created");
	}
	const send = yield* open("/admin/jobs/send");
	expect(send.text).toContain("read-only");
	expect((yield* open("/admin/jobs/send", { method: "POST" })).status).toBe(FORBIDDEN_STATUS);
});

const protectedPaths = [
	"/admin/jobs",
	"/admin/jobs/",
	"/admin/jobs/queues",
	"/admin/jobs/jobs?state=failed",
	"/admin/jobs/queues/count-note-words-dlq",
	"/admin/jobs.data",
	"/admin/jobs/queues/count-note-words.data",
	"/admin/jobs/queues/count-note-words/metrics.data",
	"/admin/jobs/assets/manifest.js",
	"/admin/jobs/assets/missing.js",
	"/admin/jobs/not-a-route",
];

jobBoard.it("every board path refuses a signed-in non-admin", [boardSession("admin"), boardSession("user")], function* ({ open }) {
	const home = yield* open("/admin/jobs", { as: "admin" });
	expect(home.assets).not.toEqual([]);
	for (const path of [...protectedPaths, ...home.assets]) {
		expect((yield* open(path)).status, path).toBe(FORBIDDEN_STATUS);
		expect((yield* open(path, { method: "HEAD" })).status, path).toBe(FORBIDDEN_STATUS);
		expect((yield* open(path, { method: "POST" })).status, path).toBe(FORBIDDEN_STATUS);
	}
});

jobBoard.it("every board path refuses a signed-out visitor", [boardSession("admin")], function* ({ open }) {
	const home = yield* open("/admin/jobs");
	expect(home.assets).not.toEqual([]);
	for (const path of [...protectedPaths, ...home.assets]) {
		expect((yield* open(path, { as: "visitor" })).status, path).toBe(UNAUTHORIZED_STATUS);
		expect((yield* open(path, { as: "visitor", method: "HEAD" })).status, path).toBe(UNAUTHORIZED_STATUS);
		expect((yield* open(path, { as: "visitor", method: "POST" })).status, path).toBe(UNAUTHORIZED_STATUS);
	}
});
