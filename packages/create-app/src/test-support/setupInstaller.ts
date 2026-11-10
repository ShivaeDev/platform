import { dirname } from "node:path";

function sourceBin(cli: string, stubbedQualityExit?: number) {
	const preCommit =
		stubbedQualityExit === undefined
			? ""
			: `if (process.argv[2] === "hooks" && process.argv[3] === "pre-commit") {
  const fs = process.getBuiltinModule("node:fs");
  fs.appendFileSync(".git/quality-calls.log", "quality hooks pre-commit\\n");
  fs.writeFileSync(".git/initial-gate.json", JSON.stringify({
    staged: spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout
  }));
  process.exit(${stubbedQualityExit});
}
`;
	return `#!/usr/bin/env node
const { spawnSync } = process.getBuiltinModule("node:child_process");
${preCommit}const result = spawnSync(process.execPath, ["--conditions=@shivaedev/source", ${JSON.stringify(cli)}, ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`;
}

export function setupInstaller(
	pnpm: string,
	modules: string,
	hoisted: string,
	quality: string,
	skills: string,
	{ scriptsOnly = false, stubbedQualityExit }: { readonly scriptsOnly?: boolean; readonly stubbedQualityExit?: number | undefined } = {},
) {
	// pnpm rebuilds the seeded install before a package script, so it must keep the workspace Quality engine.
	const qualityBin = sourceBin(quality, stubbedQualityExit);
	const skillsBin = sourceBin(skills);
	return `#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { join, relative } = require("node:path");
const args = process.argv.slice(2);
const command = args.join(" ");
if (${stubbedQualityExit !== undefined} && (command === "run format" || command === "baseline prune")) {
  fs.appendFileSync(".git/quality-calls.log", "pnpm " + command + "\\n");
  process.exit(0);
}
if (${scriptsOnly} && args[0] === "run") {
  if (args[1] === "format") process.exit(0);
  if (args[1] === "setup") args.splice(0, args.length, "install");
}
if (args[0] === "install") {
  const qualityRoot = ${JSON.stringify(dirname(dirname(quality)))};
  const qualityPackage = join(__dirname, "quality-package");
  fs.rmSync(qualityPackage, { recursive: true, force: true });
  fs.mkdirSync(qualityPackage, { recursive: true });
  for (const entry of fs.readdirSync(qualityRoot)) {
    if (entry !== "package.json") fs.symlinkSync(join(qualityRoot, entry), join(qualityPackage, entry));
  }
  const qualityManifest = JSON.parse(fs.readFileSync(join(qualityRoot, "package.json"), "utf8"));
  qualityManifest.bin = { quality: "./quality.js" };
  fs.writeFileSync(join(qualityPackage, "package.json"), JSON.stringify(qualityManifest));
  fs.writeFileSync(join(qualityPackage, "quality.js"), ${JSON.stringify(qualityBin)}, { mode: 0o755 });
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  manifest.devDependencies["@shivaedev/quality"] = "workspace:" + relative(process.cwd(), qualityPackage);
  fs.writeFileSync("package.json", JSON.stringify(manifest, null, "\\t") + "\\n");
  const compiler = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
  compiler.compilerOptions.customConditions = ["@shivaedev/source"];
  fs.writeFileSync("tsconfig.json", JSON.stringify(compiler, null, "\\t") + "\\n");
  fs.writeFileSync("pnpm-lock.yaml", "lockfileVersion: 9.0\\n");
  const modules = ${JSON.stringify(modules)};
  fs.rmSync("node_modules", { recursive: true, force: true });
  fs.mkdirSync("node_modules/.bin", { recursive: true });
  for (const name of fs.readdirSync(modules)) {
    if (name.startsWith("@")) {
      fs.mkdirSync(join("node_modules", name));
      for (const dependency of fs.readdirSync(join(modules, name))) {
        fs.symlinkSync(fs.realpathSync(join(modules, name, dependency)), join("node_modules", name, dependency));
      }
    } else if (!name.startsWith(".")) {
      fs.symlinkSync(fs.realpathSync(join(modules, name)), join("node_modules", name));
    }
  }
  const hoisted = ${JSON.stringify(hoisted)};
  for (const dependency of fs.readdirSync(hoisted)) {
    if (!fs.existsSync(join("node_modules/@shivaedev", dependency))) {
      fs.symlinkSync(fs.realpathSync(join(hoisted, dependency)), join("node_modules/@shivaedev", dependency));
    }
  }
  for (const name of fs.readdirSync(join(modules, ".bin"))) {
    if (!["quality", "shivaedev-skills"].includes(name)) fs.symlinkSync(join(modules, ".bin", name), join("node_modules/.bin", name));
  }
  fs.writeFileSync("node_modules/.bin/quality", ${JSON.stringify(qualityBin)}, { mode: 0o755 });
  fs.writeFileSync("node_modules/.bin/shivaedev-skills", ${JSON.stringify(skillsBin)}, { mode: 0o755 });
  if (fs.existsSync(".git")) {
    fs.writeFileSync(".git/setup-order.json", JSON.stringify({
      head: spawnSync("git", ["rev-parse", "--verify", "HEAD"]).status,
      staged: spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout
    }));
  }
  if (${scriptsOnly}) {
    const result = spawnSync(process.execPath, ["--conditions=@shivaedev/source", ${JSON.stringify(skills)}, "sync"], { stdio: "inherit" });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
  process.exit(0);
}
if (args[0] === "run" && args[1] === "typecheck") {
  fs.writeFileSync(".git/initial-gate.json", JSON.stringify({
    staged: spawnSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).stdout
  }));
  process.exit(0);
}
const result = spawnSync(${JSON.stringify(pnpm)}, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`;
}
