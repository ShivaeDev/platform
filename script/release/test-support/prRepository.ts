import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { Effect, FileSystem } from "effect";

export const releasePrRepository = Effect.fn("ReleasePrRepository.releasePrRepository")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "release-pr-" });
	const root = join(temporary, "workspace");
	const origin = join(temporary, "origin.git");
	yield* fs.makeDirectory(root);
	function git(...args: readonly string[]) {
		return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	}
	const write = Effect.fn("ReleasePrRepository.write")(function* (path: string, text: string) {
		yield* fs.makeDirectory(dirname(join(root, path)), { recursive: true });
		yield* fs.writeFileString(join(root, path), text);
	});
	for (const [name, version] of [
		["platform", "0.15.0"],
		["create-app", "0.9.0"],
	] as const) {
		yield* write(`packages/${name}/package.json`, JSON.stringify({ name: `@shivaedev/${name}`, version }));
		yield* write(`packages/${name}/CHANGELOG.md`, "# Changelog\n");
	}
	yield* write(
		"pnpm-workspace.yaml",
		'catalog:\n  lucide-react: 1.57.0\n  "@types/node": 24.19.2\n  root-only: 1.0.0\ncatalogs:\n  legacy:\n    lucide-react: 1.0.0\n',
	);
	yield* write(
		"examples/starter/pnpm-workspace.copy.yaml",
		'packages: []\n\ncatalog:\n  lucide-react: 1.57.0\n  "@types/node": 24.19.2 # Node types\n  starter-only: 2.0.0\n',
	);
	yield* write("package.json", '{"private":true,"packageManager":"pnpm@12.13.0+sha512.root-integrity"}\n');
	yield* write("examples/starter/package.json", '{"name":"@shivaedev/starter","private":true,"version":"0.0.0","packageManager":"pnpm@12.13.0"}\n');
	yield* write("examples/starter/published-versions.json", '{"@shivaedev/platform":"0.15.0"}\n');
	yield* write(".changeset/README.md", "Pending changesets.\n");
	git("init", "-b", "main");
	git("init", "--bare", origin);
	git("config", "user.name", "Release stories");
	git("config", "user.email", "release@example.test");
	git("remote", "add", "origin", origin);
	git("add", ".");
	git("commit", "-m", "Initial packages");
	git("push", "-u", "origin", "main");
	return {
		git,
		pushMain: Effect.fn("ReleasePrRepository.pushMain")(function* (path: string, text: string) {
			git("switch", "main");
			yield* write(path, text);
			git("add", ".");
			git("commit", "-m", "Pending change");
			git("push", "origin", "main");
		}),
		root,
		write,
	};
});
