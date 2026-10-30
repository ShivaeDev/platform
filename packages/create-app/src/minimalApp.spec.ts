import { expect } from "vitest";
import { application } from "#test/application.ts";
import { realSetup } from "#test/traits.ts";

application.it("creates the same foundation without the notes module or its registrations", [], function* ({ cli, generatedFiles, read, exists }) {
	const result = yield* cli(["my-app", "--minimal", "--no-git"]);
	expect(result.status, result.stderr).toBe(0);
	const minimal = generatedFiles();
	expect(exists("src/modules/notes")).toBe(false);
	expect(JSON.parse(read("package.json")).dependencies).not.toHaveProperty("@tanstack/react-table");
	for (const path of ["src/client/ui/chart.tsx", "src/client/ui/tooltip.tsx"]) {
		expect(exists(path), path).toBe(false);
	}
	expect(JSON.parse(read("package.json")).dependencies).not.toHaveProperty("recharts");
	for (const path of [
		"src/modules.ts",
		"src/server/modules.ts",
		"src/server/workerModules.ts",
		"src/server/migrations.ts",
		"src/client/modules.ts",
	]) {
		expect(read(path)).not.toMatch(/notes(?:Registration|Worker|Migrations)|notesModule|noteQueue|#modules\/notes/u);
	}
	expect(JSON.parse(read(".create-app.json"))).toMatchObject({ minimal: true });
	expect((yield* cli(["another/my-app", "--no-git"])).status).toBe(0);
	expect(exists("src/modules/notes")).toBe(true);
	expect(
		generatedFiles()
			.filter((file) => !file.path.startsWith("src/modules/notes/"))
			.map((file) => file.path),
	).toEqual(minimal.map((file) => file.path));
	for (const file of minimal) {
		if (
			![
				".env.local",
				".create-app.json",
				"quality-baseline.jsonl",
				"package.json",
				"src/modules.ts",
				"src/server/modules.ts",
				"src/server/workerModules.ts",
				"src/server/migrations.ts",
				"src/client/modules.ts",
			].includes(file.path)
		) {
			expect(read(file.path), file.path).toBe(file.content);
		}
	}
});

application.it(
	"the minimal app serves the foundation admin pages, migrates and passes ready against workspace packages",
	[realSetup],
	function* ({ cli, prepareDatabases, migrate, ready, runAdminStories }) {
		const name = `minimal_${crypto.randomUUID().replaceAll("-", "")}`;
		const created = yield* cli([name, "--minimal", "--no-git"]);
		expect(created.status, created.stderr).toBe(0);
		const prepared = prepareDatabases();
		expect(prepared.status, prepared.stderr).toBe(0);
		const migrated = migrate();
		expect(migrated.status, migrated.stderr).toBe(0);
		const admin = runAdminStories(true);
		expect(admin.status, admin.stdout + admin.stderr).toBe(0);
		const checked = ready();
		expect(checked.status, checked.stdout + checked.stderr).toBe(0);
	},
	120_000,
);
