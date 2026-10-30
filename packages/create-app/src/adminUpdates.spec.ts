import { expect } from "vitest";
import { updates } from "#test/updates.ts";

const dashboardFiles = [
	"src/server/checkDashboardVersion.ts",
	"src/server/jobDashboard.ts",
	"src/server/readOnlyDashboard.ts",
	"src/server/readOnlyDashboardWorker.ts",
];

updates.it("adds Users to the foundation while keeping its custom admin title", [], function* (app) {
	const path = "src/foundationPages.ts";
	const current = app.starterFile(path);
	const before = current
		.replace(/^import \{ usersPage \}.*\n/gmu, "")
		.replace(/^const UsersPage =.*\n/gmu, "")
		.replace("adminRegistry(JobsPage, UsersPage)", "adminRegistry(JobsPage)");
	app.setVersion("0.1.0");
	app.revise({ [path]: before });
	expect((yield* app.create()).status).toBe(0);
	app.publish();
	app.edit("src/client/admin/Shell.tsx", app.read("src/client/admin/Shell.tsx").replace("Your app", "Acme operations"));
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Name statistics");
	app.setVersion("0.2.0");
	app.revise({ [path]: current });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.read("src/client/admin/Shell.tsx")).toContain("Acme operations");
	expect(app.read(path)).toContain("adminRegistry(JobsPage, UsersPage)");
	expect(app.read(path)).toContain('import { usersPage } from "@shivaedev/admin/users/page.ts"');
});

updates.it("removes the old dashboard while merging customized admin views", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise(Object.fromEntries(dashboardFiles.map((file) => [file, "export const dashboard = true;\n"])));
	expect((yield* app.create()).status).toBe(0);
	const path = "src/client/admin/Shell.tsx";
	const shell = app.read(path);
	app.publish();
	app.edit(path, shell.replace("Your app", "Acme operations"));
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize app");
	app.setVersion("0.2.0");
	for (const file of dashboardFiles) {
		app.removeFromStarter(file);
	}
	app.revise({ [path]: shell.replace("Administration</p>", "Operator tools</p>") });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.read(path)).toContain("Acme operations");
	expect(app.read(path)).toContain("Operator tools</p>");
	for (const file of dashboardFiles) {
		expect(app.exists(file), file).toBe(false);
	}
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.2.0");
});

updates.it("lists customized admin view conflicts while removing the old dashboard", [], function* (app) {
	app.setVersion("0.1.0");
	app.revise(Object.fromEntries(dashboardFiles.map((file) => [file, "export const dashboard = true;\n"])));
	expect((yield* app.create()).status).toBe(0);
	const path = "src/client/admin/Shell.tsx";
	const shell = app.read(path);
	app.publish();
	app.edit(path, shell.replace("Your app", "Acme operations"));
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize app");
	app.setVersion("0.2.0");
	for (const file of dashboardFiles) {
		app.removeFromStarter(file);
	}
	app.revise({ [path]: shell.replace("Your app", "New app name") });
	const result = yield* app.update();
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain(`Resolve these conflicts, then commit your changes:\n${path}`);
	expect(app.git("diff", "--name-only", "--diff-filter=U").stdout).toBe(`${path}\n`);
	expect(app.read(path)).toContain("<<<<<<< ours");
	expect(app.read(path)).toContain("Acme operations");
	expect(app.read(path)).toContain("New app name");
	for (const file of dashboardFiles) {
		expect(app.exists(file), file).toBe(false);
	}
	expect(JSON.parse(app.read(".create-app.json")).version).toBe("0.1.0");
});

updates.it("merges permission imports and role files while preserving an app's custom grants", [], function* (app) {
	const path = "src/AppAccess.ts";
	const current = app.starterFile(path);
	app.setVersion("0.1.0");
	app.revise({
		[path]:
			'import { roleSet } from "@shivaedev/access/roleSet.ts";\nimport { role } from "@shivaedev/access/role.ts";\nimport { OpenAdmin } from "@shivaedev/admin/permissions.ts";\nexport const AppAccess = roleSet(role("user", []), role("admin", [OpenAdmin]));\n',
	});
	expect((yield* app.create()).status).toBe(0);
	app.publish();
	const role = "src/roles/Owner.ts";
	app.edit(role, app.read(role).replace("[ReadUsers,", "[ReadUsers, ReadUsers.any,"));
	app.git("add", "--all");
	app.git("-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", "Customize grants");
	app.setVersion("0.2.0");
	app.revise({ [path]: current });
	const result = yield* app.update();
	expect(result.status, result.stderr).toBe(0);
	expect(app.read(path)).toBe(current);
	expect(app.read(role)).toContain("ReadUsers.any");
});
