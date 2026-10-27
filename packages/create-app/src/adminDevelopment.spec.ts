import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"a freshly generated app serves admin routes and enforces its declared permissions",
	[],
	function* ({ cli, prepareDatabases, runAdminStories }) {
		const name = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
		const generated = yield* cli([name, "--no-git"]);
		expect(generated.status, generated.stdout + generated.stderr).toBe(0);
		const databases = prepareDatabases();
		expect(databases.status, databases.stdout + databases.stderr).toBe(0);
		const stories = runAdminStories();
		expect(stories.status, stories.stdout + stories.stderr).toBe(0);
	},
);
