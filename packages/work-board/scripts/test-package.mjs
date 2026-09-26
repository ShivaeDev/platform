import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "work-board-consumer-"));
const tarball = join(temporaryDirectory, "work-board.tgz");
const bin = join(temporaryDirectory, "node_modules/.bin/work-board");

const execute = (command, arguments_, cwd = temporaryDirectory) =>
	execFileSync(command, arguments_, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	});

const writeJson = (path, value) => writeFile(join(temporaryDirectory, path), `${JSON.stringify(value, null, 2)}\n`);

const listening = (server) =>
	new Promise((resolve, reject) => {
		let output = "";
		const timer = setTimeout(() => reject(new Error(`work-board did not start:\n${output}`)), 15_000);
		server.stdout.on("data", (chunk) => {
			output += chunk;
			const address = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
			if (address !== null) {
				clearTimeout(timer);
				resolve(address[0]);
			}
		});
		server.on("exit", (code) => reject(new Error(`work-board exited ${code}:\n${output}`)));
	});

try {
	execute("pnpm", ["pack", "--out", tarball], packageRoot);

	const contents = execute("tar", ["-tzf", tarball]).trim().split("\n");
	for (const required of [
		"package/dist/cli.js",
		"package/dist/index.js",
		"package/dist/index.d.ts",
		"package/dist/index.d.ts.map",
		"package/src/index.ts",
		"package/CHANGELOG.md",
		"package/README.md",
	]) {
		if (!contents.includes(required)) {
			throw new Error(`Packed package is missing ${required}`);
		}
	}
	if (contents.some((path) => path.startsWith("package/test/"))) {
		throw new Error("Packed package unexpectedly contains its test suite");
	}
	const packedManifest = JSON.parse(execute("tar", ["-xOzf", tarball, "package/package.json"]));
	if (
		packedManifest.bin?.["work-board"] !== "./dist/cli.js" ||
		JSON.stringify([packedManifest.dependencies, packedManifest.peerDependencies]).includes("catalog:")
	) {
		throw new Error("Packed manifest must expose the work-board bin and pin its dependencies");
	}

	const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
	await writeJson("package.json", {
		name: "work-board-consumer",
		private: true,
		type: "module",
		dependencies: {
			"@shivaedev/work-board": `file:${tarball}`,
			"@effect/platform-node": manifest.peerDependencies["@effect/platform-node"],
			"@types/node": manifest.devDependencies["@types/node"],
			effect: manifest.peerDependencies.effect,
		},
	});
	await writeFile(join(temporaryDirectory, "pnpm-workspace.yaml"), await readFile(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"));
	const compilerOptions = {
		lib: ["ESNext", "DOM"],
		module: "ESNext",
		moduleResolution: "Bundler",
		noEmit: true,
		skipLibCheck: true,
		strict: true,
		target: "ESNext",
		types: ["node"],
		verbatimModuleSyntax: true,
	};
	await writeJson("tsconfig.json", { compilerOptions, include: ["index.ts"] });
	await writeJson("tsconfig.nodenext.json", { extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } });
	await writeFile(
		join(temporaryDirectory, "index.ts"),
		`import { NodeServices } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { boardLayer } from "@shivaedev/work-board"

export const board = HttpRouter.toWebHandler(Layer.provide(boardLayer({ root: ".", home: "plan.md" }), NodeServices.layer))
`,
	);

	execute("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false", "--store-dir", join(repositoryRoot, ".pnpm-store")]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc"), ["--project", "tsconfig.nodenext.json"]);
	execute(join(packageRoot, "node_modules/.bin/tsc6"), ["--project", "tsconfig.json"]);

	if (!execute(bin, ["--version"]).includes(manifest.version)) {
		throw new Error(`work-board --version does not print ${manifest.version}`);
	}
	const folder = join(temporaryDirectory, "board");
	await mkdir(folder);
	await writeFile(join(folder, "plan.md"), "# Plan\n\n## To do\n\n### `ops` Rotate the key\n");
	const server = spawn(bin, [folder, "--port", "0", "--home", "plan.md"], { stdio: ["ignore", "pipe", "inherit"] });
	try {
		const address = await listening(server);
		const page = await (await fetch(address)).text();
		if (!page.includes("<span><b>1</b> to do</span>")) {
			throw new Error(`The packed server did not render the board:\n${page}`);
		}
		for (const asset of ["/_board/style.css", "/_board/client.js", "/_board/mermaid/mermaid.esm.min.mjs"]) {
			const response = await fetch(`${address}${asset}`);
			if (response.status !== 200) {
				throw new Error(`The packed server answered ${response.status} for ${asset}`);
			}
		}
	} finally {
		server.kill();
	}
} finally {
	await rm(temporaryDirectory, { force: true, recursive: true });
}
