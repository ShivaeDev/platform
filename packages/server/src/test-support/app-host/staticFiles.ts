import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetOptions } from "#AssetOptions.ts";
import { staticAssets } from "./fixture.ts";
import { io } from "./state.ts";
import { host } from "./story.ts";

export function staticFiles(options: Omit<AssetOptions, "root"> = {}, shorthand = false) {
	return host.trait("configured", "the host serves documents and fingerprinted and unversioned assets", (state) =>
		io(async () => {
			const files = await staticAssets();
			state.cleanup.push(files.close);
			await mkdir(join(files.path, "assets"));
			await writeFile(join(files.path, "assets", "app-a1b2c3d4.js"), "console.log('Hosted asset')");
			await writeFile(join(files.path, "assets", "app-DiwrgTda.css"), "main { color: red }");
			await writeFile(join(files.path, "service-worker.js"), "self.addEventListener('fetch', () => {})");
			await writeFile(join(files.path, "release-a1b2c3d4.html"), "<main>Release</main>");
			await writeFile(join(files.path, "shell.page"), "<main>Custom shell</main>");
			state.assets = shorthand ? files.path : { root: files.path, spa: true, ...options };
		}),
	);
}
