import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Clock } from "effect";
import { application } from "./application.ts";
import { npmRegistry, type Release } from "./npmRegistry.ts";
import { templateManifest } from "./templateManifest.ts";
import { templateSource } from "./templateSource.ts";

export function registryTemplate(releases: Readonly<Record<string, Release>>) {
	return application.trait("template", "the app installs registry releases without approving release-age policy changes", function* (engine) {
		const root = dirname(engine.root);
		const config = join(root, "pnpm-config");
		const npmrc = join(root, "npmrc");
		mkdirSync(config);
		writeFileSync(npmrc, "");
		engine.environment.push(`XDG_CONFIG_HOME=${config}`, `npm_config_userconfig=${npmrc}`);
		const now = new Date(yield* Clock.currentTimeMillis).toISOString();
		const published = Object.fromEntries(
			Object.entries(releases).map(([name, release]) => [
				name,
				{ ...release, publishedAt: release.publishedAt === "now" ? now : release.publishedAt },
			]),
		);
		const registry = yield* npmRegistry(join(root, "registry"), published);
		const starter = engine.source.starter;
		const workspace = readFileSync(join(starter, "pnpm-workspace.copy.yaml"), "utf8");
		const versions = Object.fromEntries(Object.entries(releases).map(([name, release]) => [name, release.version]));
		const dependencies = Object.fromEntries(
			Object.entries(versions).map(([name, version]) => [name, name.startsWith("@shivaedev/") ? "workspace:*" : version]),
		);
		engine.source = templateSource(dirname(dirname(engine.cli)));
		engine.source.files({
			".gitignore": readFileSync(join(starter, ".gitignore"), "utf8"),
			".npmrc": `registry=${registry}\n`,
			"package.json": templateManifest(dependencies),
			"pnpm-workspace.copy.yaml": `${workspace}
minimumReleaseAgeStrict: true
storeDir: ${JSON.stringify(join(root, "store"))}
cacheDir: ${JSON.stringify(join(root, "cache"))}
fetchRetries: 0
`,
			"published-versions.json": JSON.stringify(versions),
			"src/setup.ts": `import { writeFileSync } from "node:fs";
const installed = {};
for (const name of ${JSON.stringify(Object.keys(releases))}) {
 installed[name] = (await import(name)).version;
}
writeFileSync("installed-dependencies.json", JSON.stringify(installed));
`,
		});
		const installer = spawnSync("which", ["pnpm"], { encoding: "utf8" });
		if (installer.status !== 0) {
			throw new Error("The app needs pnpm installed");
		}
		engine.options = { ...engine.options, installer: installer.stdout.trim() };
		engine.environment.push("CI=true");
	});
}
