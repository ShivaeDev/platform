import { expect } from "vitest";
import { application } from "#test/application.ts";
import { registryTemplate } from "#test/registryTemplate.ts";

application.it(
	"installs a just-published framework release, runs app setup and commits the installed app",
	[
		registryTemplate({
			"@shivaedev/platform": { publishedAt: "now", version: "1.0.0" },
			effect: { publishedAt: "2020-01-01T00:00:00.000Z", version: "1.0.0" },
		}),
	],
	function* ({ cli, read, git }) {
		const result = yield* cli(["my-app"]);
		expect(result.status, result.stdout + result.stderr).toBe(0);
		expect(JSON.parse(read("installed-dependencies.json"))).toEqual({ "@shivaedev/platform": "1.0.0", effect: "1.0.0" });
		expect(git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	},
);

application.it(
	"blocks a just-published third-party dependency before app setup or an initial commit",
	[
		registryTemplate({
			"@shivaedev/platform": { publishedAt: "now", version: "1.0.0" },
			effect: { publishedAt: "now", version: "1.0.0" },
		}),
	],
	function* ({ cli, exists, git }) {
		const result = yield* cli(["my-app"]);
		expect(result.status, result.stdout + result.stderr).toBe(1);
		expect(result.stderr).toContain("pnpm run setup failed");
		expect(result.stdout + result.stderr).toContain("minimumReleaseAge");
		expect(exists("installed-dependencies.json")).toBe(false);
		expect(git("rev-parse", "--verify", "HEAD").status).not.toBe(0);
	},
);
