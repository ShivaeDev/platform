import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it("creates the same foundation without the notes module or its registrations", [], function* ({ cli, generatedFiles, read, exists }) {
	const result = yield* cli(["my-app", "--minimal", "--no-git"]);
	expect(result.status, result.stderr).toBe(0);
	const minimal = generatedFiles();
	expect(exists("src/modules/notes")).toBe(false);
	for (const path of ["src/server/modules.ts", "src/server/workerModules.ts", "src/server/migrations.ts", "src/client/modules.ts"]) {
		expect(read(path)).not.toMatch(/notes(?:Registration|Worker|Migrations)|#modules\/notes/u);
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
