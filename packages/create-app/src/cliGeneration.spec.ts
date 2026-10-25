import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { configuredIdentity, customTemplate, destination, enclosingRepository, installationFails, missingGit } from "#test/traits.ts";

const version: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

application.it("creates a named app, installs, commits with a fallback identity and prints next steps", [], function* ({ cli, read, git }) {
	const result = yield* cli(["apps/my-app"], ["EMAIL=guessed@example.com"]);
	expect(result.status, result.stderr).toBe(0);
	expect(JSON.parse(read("package.json"))).toMatchObject({ name: "my-app" });
	expect(read("package.json")).toMatch(/^\{\n\t"name": "my-app",/u);
	expect(read("installation.json")).toBe('["run","setup"]');
	expect(git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	expect(git("log", "-1", "--format=%an <%ae>").stdout).toBe("Create App <create-app@localhost>\n");
	expect(git("status", "--porcelain").stdout).toBe("");
	const tracked = git("ls-files").stdout.split("\n");
	expect(tracked).toEqual(
		expect.arrayContaining(["package.json", "pnpm-lock.yaml", ".github/workflows/ci.yml", ".railway/railway.ts", "src/modules/notes/notes.ts"]),
	);
	expect(tracked).not.toContain(".env.local");
	expect(result.stdout).toMatch(/Created apps\/my-app\.\n\nNext steps:\n {2}cd 'apps\/my-app'\n {2}pnpm dev\n$/u);
});

application.it("preserves the configured Git identity for the initial commit", [configuredIdentity], function* ({ cli, git }) {
	expect((yield* cli(["my-app"])).status).toBe(0);
	expect(git("log", "-1", "--format=%an <%ae>").stdout).toBe("App Author <author@example.com>\n");
});

for (const [name, traits, args] of [
	["disabled", [], ["my-app", "--no-git"]],
	["unavailable", [missingGit], ["my-app"]],
] as const) {
	application.it(`skips Git when ${name}`, traits, function* ({ cli, exists }) {
		const result = yield* cli(args);
		expect(result.status, result.stderr).toBe(0);
		expect(exists(".git")).toBe(false);
	});
}

application.it(
	"leaves an enclosing repository without a nested repository or new commit",
	[enclosingRepository],
	function* ({ cli, exists, parentGit }) {
		expect((yield* cli(["apps/my-app"])).status).toBe(0);
		expect(exists(".git")).toBe(false);
		expect(parentGit("rev-parse", "--verify", "HEAD").status).not.toBe(0);
		expect(parentGit("diff", "--cached", "--name-only").stdout).toBe("");
	},
);

application.it("preserves the environment and refuses another run after installation failure", [installationFails()], function* ({ cli, read }) {
	expect((yield* cli(["my-app", "--no-git"])).status).toBe(1);
	const env = read(".env.local");
	expect((yield* cli(["my-app", "--no-git"])).stderr).toContain("the destination must be an empty folder");
	expect(read(".env.local")).toBe(env);
});

application.it("does not overwrite a user environment", [destination("environment")], function* ({ cli, read, files }) {
	expect((yield* cli(["my-app"])).status).toBe(1);
	expect(read(".env.local")).toBe("user settings");
	expect(files()).toEqual([".env.local"]);
});

application.it("prints a working cd command for paths with shell characters", [], function* ({ cli, navigate, workspace }) {
	const folder = "parent 'quoted' $literal/my-app";
	const result = yield* cli([folder, "--no-git"]);
	expect(result.status).toBe(0);
	const cd = result.stdout.split("\n").find((line) => line.trimStart().startsWith("cd "));
	expect(cd).toBeDefined();
	const navigation = navigate(cd ?? "");
	expect(navigation.status).toBe(0);
	expect(navigation.stdout.trim()).toBe(join(workspace, folder));
});

application.it("accepts an existing empty folder", [destination("empty")], function* ({ cli, exists }) {
	expect((yield* cli(["my-app", "--no-git"])).status).toBe(0);
	expect(exists("src/modules/notes/notes.ts")).toBe(true);
});

for (const kind of ["file", "nonempty"] as const) {
	application.it(`refuses a ${kind} destination without writing or installing`, [destination(kind)], function* ({ cli, destinationContents }) {
		const result = yield* cli(["my-app"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("the destination must be an empty folder");
		expect(destinationContents()).toEqual(kind === "file" ? { ".": "user data" } : { ".keep": "user data" });
	});
}

application.it("reports installation failure and leaves the app available for retry", [installationFails()], function* ({ cli, exists, git }) {
	const result = yield* cli(["my-app"]);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("pnpm run setup failed (exit 7)");
	expect(result.stderr).toContain("Run pnpm run setup in my-app to retry");
	expect(result.stdout).not.toContain("Next steps");
	expect(exists("package.json")).toBe(true);
	expect(git("rev-parse", "--verify", "HEAD").status).not.toBe(0);
});

application.it("rejects invalid package names before creating folders", [], function* ({ cli, workspaceExists }) {
	for (const name of ["Bad Name", "node_modules", "favicon.ico"]) {
		expect((yield* cli([name])).status).toBe(1);
		expect(workspaceExists(name)).toBe(false);
	}
});

application.it(
	"provides help and version without packing a template or generating an app",
	[customTemplate({ "package.json": "invalid JSON" })],
	function* ({ cli, workspaceFiles }) {
		const help = yield* cli(["--help"]);
		expect(help.status).toBe(0);
		expect(help.stdout).toContain("folder");
		expect(help.stdout).toContain("--minimal");
		expect(yield* cli(["--version"])).toMatchObject({ status: 0, stdout: `create-app v${version}\n` });
		expect(workspaceFiles()).toEqual(["bin"]);
	},
);

application.it("writes app database URLs and fresh secrets on each run, ignored by Git", [], function* ({ cli, read, git }) {
	const secrets = new Set<string>();
	for (const folder of ["first/my-app", "second/my-app"]) {
		expect((yield* cli([folder])).status).toBe(0);
		const env = read(".env.local");
		expect(read(".env.example")).toContain("/my_app_dev\n");
		expect(read(".env.example")).toContain("/my_app_test\n");
		expect(env).toContain("DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/my_app_dev\n");
		expect(env).toContain("TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/my_app_test\n");
		const secret = env.match(/^BETTER_AUTH_SECRET=(?<secret>.+)$/mu)?.groups?.secret ?? "";
		expect(secret.length).toBeGreaterThanOrEqual(32);
		secrets.add(secret);
		expect(git("check-ignore", ".env.local").stdout).toBe(".env.local\n");
	}
	expect(secrets.size).toBe(2);
});
