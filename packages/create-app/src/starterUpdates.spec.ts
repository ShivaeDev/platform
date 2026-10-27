import { expect } from "vitest";
import { updates } from "#test/updates.ts";

updates.it("replays a later starter release and records it without committing", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	const created = yield* app.create();
	expect(created.status, created.stderr).toBe(0);
	expect(JSON.parse(app.read(".create-app.json"))).toEqual({ name: "my-app", version: "0.1.0" });
	app.publish();
	app.setVersion("0.2.0");
	app.revise({ "added.txt": "new file\n", "upgrade.txt": "new starter content\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.read("upgrade.txt")).toBe("new starter content\n");
	expect(app.read("added.txt")).toBe("new file\n");
	expect(JSON.parse(app.read(".create-app.json"))).toEqual({ name: "my-app", version: "0.2.0" });
	expect(app.git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	expect(app.git("status", "--porcelain").stdout).toContain("upgrade.txt");
});

updates.it("leaves overlapping edits as listed Git conflicts and keeps the recorded version", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	expect((yield* app.create()).status).toBe(0);
	app.publish();
	app.edit("upgrade.txt", "app content\n");
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize app");
	app.setVersion("0.2.0");
	app.revise({ "upgrade.txt": "starter content\n" });
	const result = yield* app.update();
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("Resolve these conflicts, then commit your changes:\nupgrade.txt");
	expect(app.read("upgrade.txt")).toContain("<<<<<<< ours\napp content\n=======\nstarter content\n>>>>>>> theirs");
	expect(app.git("diff", "--name-only", "--diff-filter=U").stdout).toBe("upgrade.txt\n");
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.1.0");
});

updates.it("keeps files the app deleted out of a later starter release", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise({ "upgrade.txt": "original\n" });
	expect((yield* app.create()).status).toBe(0);
	app.publish();
	app.remove("upgrade.txt");
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Remove example");
	app.setVersion("0.2.0");
	app.revise({ "upgrade.txt": "starter content\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.git("ls-files", "upgrade.txt").stdout).toBe("");
	expect(app.git("status", "--porcelain").stdout).not.toContain("upgrade.txt");
});

updates.it("refuses a dirty working tree before fetching or changing files", [], function* (app) {
	app.setVersion("0.1.0");
	expect((yield* app.create()).status).toBe(0);
	app.edit("README.md", "app draft\n");
	app.setVersion("0.2.0");
	const result = yield* app.update();
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("Refusing to update a dirty working tree");
	expect(app.read("README.md")).toBe("app draft\n");
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.1.0");
});

updates.it("keeps a minimal app free of notes when a later starter adds example files", [], function* (app) {
	app.setVersion("0.1.0");
	expect((yield* app.create(["--minimal"])).status).toBe(0);
	app.publish();
	app.setVersion("0.2.0");
	app.revise({ "foundation.txt": "new foundation\n", "src/modules/notes/new-example.ts": "export const example = true;\n" });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.git("ls-files", "src/modules/notes").stdout).toBe("");
	expect(app.read("src/server/modules.ts")).not.toContain("notesRegistration");
	expect(app.read("foundation.txt")).toBe("new foundation\n");
	expect(JSON.parse(app.read(".create-app.json"))).toEqual({ minimal: true, name: "my-app", version: "0.2.0" });
});

updates.it("moves an app that listed pieces directly onto platform and the hoist setting", [], function* (app) {
	const manifest = app.starterFile("package.json");
	const workspace = app.starterFile("pnpm-workspace.copy.yaml");
	const listed = JSON.parse(manifest);
	app.setVersion("0.1.0");
	app.revise({
		"package.json": `${JSON.stringify({ ...listed, dependencies: { ...listed.dependencies, "@shivaedev/sql": "workspace:*" } }, null, "\t")}\n`,
		"pnpm-workspace.copy.yaml": workspace.replace(/\n#[^\n]*\npublicHoistPattern:[^\n]*\n/u, "\n"),
	});
	expect((yield* app.create()).status).toBe(0);
	expect(JSON.parse(app.read("package.json")).dependencies["@shivaedev/sql"]).toBeDefined();
	expect(app.read("pnpm-workspace.yaml")).not.toContain("publicHoistPattern");
	app.publish();
	app.setVersion("0.2.0");
	app.revise({ "package.json": manifest, "pnpm-workspace.copy.yaml": workspace });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(JSON.parse(app.read("package.json")).dependencies["@shivaedev/sql"]).toBeUndefined();
	expect(app.read("pnpm-workspace.yaml")).toContain('\npublicHoistPattern: ["@shivaedev/*"]\n');
});
