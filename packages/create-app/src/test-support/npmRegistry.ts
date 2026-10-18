import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { Effect } from "effect";

export interface Release {
	readonly publishedAt: string;
	readonly version: string;
}

export const npmRegistry = Effect.fn("AppStory.npmRegistry")(function* (root: string, releases: Readonly<Record<string, Release>>) {
	const archives = new Map<string, { bytes: Buffer; integrity: string }>();
	for (const [name, release] of Object.entries(releases)) {
		const directory = join(root, encodeURIComponent(name));
		mkdirSync(join(directory, "package"), { recursive: true });
		writeFileSync(join(directory, "package/package.json"), JSON.stringify({ exports: "./index.js", name, type: "module", version: release.version }));
		writeFileSync(join(directory, "package/index.js"), `export const version = ${JSON.stringify(release.version)};\n`);
		const archive = join(directory, "package.tgz");
		const result = spawnSync("tar", ["-czf", archive, "-C", directory, "package"], { encoding: "utf8" });
		if (result.status !== 0) {
			throw new Error(`Cannot create registry archive: ${result.stderr}`);
		}
		const bytes = readFileSync(archive);
		archives.set(name, { bytes, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` });
	}
	let url = "";
	function respond(request: IncomingMessage, response: ServerResponse) {
		const path = decodeURIComponent(request.url?.slice(1) ?? "");
		const name = path.replace(/^tarballs\//u, "");
		const release = releases[name];
		const archive = archives.get(name);
		if (release === undefined || archive === undefined) {
			response.writeHead(404).end();
			return;
		}
		if (path.startsWith("tarballs/")) {
			response.writeHead(200, { "content-type": "application/octet-stream" }).end(archive.bytes);
			return;
		}
		response.writeHead(200, { "content-type": "application/json" }).end(
			JSON.stringify({
				"dist-tags": { latest: release.version },
				name,
				time: { [release.version]: release.publishedAt, created: release.publishedAt, modified: release.publishedAt },
				versions: {
					[release.version]: {
						dist: { integrity: archive.integrity, tarball: `${url}/tarballs/${encodeURIComponent(name)}` },
						name,
						version: release.version,
					},
				},
			}),
		);
	}
	const server = yield* Effect.acquireRelease(
		Effect.sync(() => createServer(respond)),
		(listening) => Effect.promise(() => new Promise<void>((resolve, reject) => listening.close((error) => (error ? reject(error) : resolve())))),
	);
	yield* Effect.promise(async () => {
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("The registry needs a TCP address");
	}
	url = `http://127.0.0.1:${address.port}`;
	return url;
});
