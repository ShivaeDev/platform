import { expect } from "vitest";
import { updates } from "#test/updates.ts";

const SUCCESSFUL_EXIT = 0;
const FAILED_EXIT = 1;

updates.it("replays a later starter release and records it without committing", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	const created = yield* app.create();
	expect(created.status, created.stderr).toBe(SUCCESSFUL_EXIT);
	expect(JSON.parse(app.read(".create-app.json"))).toEqual({ name: "my-app", version: "0.1.0" });
	app.publish();
	app.setVersion("0.2.0");
	app.revise({ "added.txt": "new file\n", "upgrade.txt": "new starter content\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(SUCCESSFUL_EXIT);
	expect(app.read("upgrade.txt")).toBe("new starter content\n");
	expect(app.read("added.txt")).toBe("new file\n");
	expect(JSON.parse(app.read(".create-app.json"))).toEqual({ name: "my-app", version: "0.2.0" });
	expect(app.git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	expect(app.git("status", "--porcelain").stdout).toContain("upgrade.txt");
});

updates.it("merges app edits in a file the starter also changes", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "title\n\none\ntwo\nthree\n\nfooter\n" });
	expect((yield* app.create()).status).toBe(SUCCESSFUL_EXIT);
	app.publish();
	app.edit("upgrade.txt", "app title\n\none\ntwo\nthree\n\nfooter\n");
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize app");
	app.setVersion("0.2.0");
	app.revise({ "upgrade.txt": "title\n\none\ntwo\nthree\n\nstarter footer\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(SUCCESSFUL_EXIT);
	expect(app.read("upgrade.txt")).toBe("app title\n\none\ntwo\nthree\n\nstarter footer\n");
});

updates.it("leaves overlapping edits as listed Git conflicts and keeps the recorded version", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	expect((yield* app.create()).status).toBe(SUCCESSFUL_EXIT);
	app.publish();
	app.edit("upgrade.txt", "app content\n");
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize app");
	app.setVersion("0.2.0");
	app.revise({ "upgrade.txt": "starter content\n" });
	const result = yield* app.update();
	expect(result.status).toBe(FAILED_EXIT);
	expect(result.stderr).toContain("Resolve these conflicts, then commit your changes:\nupgrade.txt");
	expect(app.read("upgrade.txt")).toContain("<<<<<<< ours\napp content\n=======\nstarter content\n>>>>>>> theirs");
	expect(app.git("diff", "--name-only", "--diff-filter=U").stdout).toBe("upgrade.txt\n");
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.1.0");
});

updates.it("keeps files the app deleted out of a later starter release", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	expect((yield* app.create()).status).toBe(SUCCESSFUL_EXIT);
	app.publish();
	app.remove("upgrade.txt");
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Remove example");
	app.setVersion("0.2.0");
	app.revise({ "upgrade.txt": "starter content\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(SUCCESSFUL_EXIT);
	expect(app.git("ls-files", "upgrade.txt").stdout).toBe("");
	expect(app.git("status", "--porcelain").stdout).not.toContain("upgrade.txt");
});

updates.it("refuses a dirty working tree before fetching or changing files", [], function* (app) {
	app.setVersion("0.1.0");
	expect((yield* app.create()).status).toBe(SUCCESSFUL_EXIT);
	app.edit("README.md", "app draft\n");
	app.setVersion("0.2.0");
	const result = yield* app.update();
	expect(result.status).toBe(FAILED_EXIT);
	expect(result.stderr).toContain("Refusing to update a dirty working tree");
	expect(app.read("README.md")).toBe("app draft\n");
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.1.0");
});
