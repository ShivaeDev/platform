import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { configuredIdentity, destination, enclosingRepository, installationFails, missingGit } from "#test/traits.ts";

const version: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

application.it("creates a named app, installs, commits with a fallback identity and prints next steps", [], ({ cli, read, git }) => {
	const result = cli(["apps/my-app"], ["EMAIL=guessed@example.com"]);
	expect(result.status, result.stderr).toBe(0);
	expect(JSON.parse(read("package.json"))).toMatchObject({ name: "my-app" });
	expect(read("package.json")).toMatch(/^\{\n\t"name": "my-app",/u);
	expect(read("installation.json")).toBe('["run","setup"]');
	expect(git("rev-list", "--count", "HEAD").stdout).toBe("1\n");
	expect(git("log", "-1", "--format=%an <%ae>").stdout).toBe("Create App <create-app@localhost>\n");
	expect(git("status", "--porcelain").stdout).toBe("");
	const tracked = git("ls-files").stdout.split("\n");
	expect(tracked).toEqual(
		expect.arrayContaining(["package.json", "pnpm-lock.yaml", ".github/workflows/ci.yml", ".railway/railway.ts", "src/notes.ts"]),
	);
	expect(tracked).not.toContain(".env.local");
	expect(result.stdout).toMatch(/Created apps\/my-app\.\n\nNext steps:\n {2}cd 'apps\/my-app'\n {2}pnpm dev\n$/u);
});

application.it("preserves the configured Git identity for the initial commit", [configuredIdentity], ({ cli, git }) => {
	expect(cli(["my-app"]).status).toBe(0);
	expect(git("log", "-1", "--format=%an <%ae>").stdout).toBe("App Author <author@example.com>\n");
});

for (const [name, traits, args] of [
	["disabled", [], ["my-app", "--no-git"]],
	["unavailable", [missingGit], ["my-app"]],
] as const) {
	application.it(`skips Git when ${name}`, traits, ({ cli, exists }) => {
		const result = cli(args);
		expect(result.status, result.stderr).toBe(0);
		expect(exists(".git")).toBe(false);
	});
}

application.it("leaves an enclosing repository without a nested repository or new commit", [enclosingRepository], ({ cli, exists, parentGit }) => {
	expect(cli(["apps/my-app"]).status).toBe(0);
	expect(exists(".git")).toBe(false);
	expect(parentGit("rev-parse", "--verify", "HEAD").status).not.toBe(0);
	expect(parentGit("diff", "--cached", "--name-only").stdout).toBe("");
});

application.it("preserves the environment and refuses another run after installation failure", [installationFails()], ({ cli, read }) => {
	expect(cli(["my-app", "--no-git"]).status).toBe(1);
	const env = read(".env.local");
	expect(cli(["my-app", "--no-git"]).stderr).toContain("the destination must be an empty folder");
	expect(read(".env.local")).toBe(env);
});

application.it(
	"prepares both databases and runs generated tests with the app environment on PostgreSQL",
	[],
	({ cli, prepareDatabases, runTests }) => {
		const name = `setup_${crypto.randomUUID().replaceAll("-", "")}`;
		expect(cli([name, "--no-git"]).status).toBe(0);
		const setup = prepareDatabases();
		expect(setup.status, setup.stdout + setup.stderr).toBe(0);
		const test = runTests();
		expect(test.status, test.stdout + test.stderr).toBe(0);
	},
);

application.it("does not overwrite a user environment", [destination("environment")], ({ cli, read, files }) => {
	expect(cli(["my-app"]).status).toBe(1);
	expect(read(".env.local")).toBe("user settings");
	expect(files()).toEqual([".env.local"]);
});

application.it("prints a working cd command for paths with shell characters", [], ({ cli, navigate, workspace }) => {
	const folder = "parent 'quoted' $literal/my-app";
	const result = cli([folder, "--no-git"]);
	expect(result.status).toBe(0);
	const cd = result.stdout.split("\n").find((line) => line.trimStart().startsWith("cd "));
	expect(cd).toBeDefined();
	const navigation = navigate(cd ?? "");
	expect(navigation.status).toBe(0);
	expect(navigation.stdout.trim()).toBe(join(workspace, folder));
});

application.it("accepts an existing empty folder", [destination("empty")], ({ cli, exists }) => {
	expect(cli(["my-app", "--no-git"]).status).toBe(0);
	expect(exists("src/notes.ts")).toBe(true);
});

for (const kind of ["file", "nonempty"] as const) {
	application.it(`refuses a ${kind} destination without writing or installing`, [destination(kind)], ({ cli, destinationContents }) => {
		const result = cli(["my-app"]);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("the destination must be an empty folder");
		expect(destinationContents()).toEqual(kind === "file" ? { ".": "user data" } : { ".keep": "user data" });
	});
}

application.it("reports installation failure and leaves the app available for retry", [installationFails()], ({ cli, exists, git }) => {
	const result = cli(["my-app"]);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("pnpm run setup failed (exit 7)");
	expect(result.stderr).toContain("Run pnpm run setup in my-app to retry");
	expect(result.stdout).not.toContain("Next steps");
	expect(exists("package.json")).toBe(true);
	expect(git("rev-parse", "--verify", "HEAD").status).not.toBe(0);
});

application.it("rejects invalid package names before creating folders", [], ({ cli, workspaceExists }) => {
	for (const name of ["Bad Name", "node_modules", "favicon.ico"]) {
		expect(cli([name]).status).toBe(1);
		expect(workspaceExists(name)).toBe(false);
	}
});

application.it("provides help and version without generating an app", [], ({ cli, workspaceFiles }) => {
	const help = cli(["--help"]);
	expect(help.status).toBe(0);
	expect(help.stdout).toContain("folder");
	expect(cli(["--version"])).toMatchObject({ status: 0, stdout: `create-app v${version}\n` });
	expect(workspaceFiles()).toEqual(["bin"]);
});

application.it("writes app database URLs and fresh secrets on each run, ignored by Git", [], ({ cli, read, git }) => {
	const secrets = new Set<string>();
	for (const folder of ["first/my-app", "second/my-app"]) {
		expect(cli([folder]).status).toBe(0);
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
