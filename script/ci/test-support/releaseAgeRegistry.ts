import { createHash } from "node:crypto";
import { join } from "node:path";
import { Clock, Effect, FileSystem } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { command, writeJson } from "#package-check/io.ts";

export const releaseAgeRegistry = Effect.fn("PackedAge.releaseAgeRegistry")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const now = yield* Clock.currentTimeMillis;
	const day = 24 * 60 * 60 * 1000;
	const releases = [
		{ age: 14 * day, floor: "^1.0.0", name: "release-age-parent", version: "1.0.0" },
		{ age: 8 * day, floor: "^1.0.2", name: "release-age-parent", version: "1.1.0" },
		{ age: day, floor: "^1.0.3", name: "release-age-parent", version: "1.2.0" },
		{ age: 14 * day, name: "release-age-leaf", version: "1.0.1" },
		{ age: 7 * day - 2 * 60 * 1000, name: "release-age-leaf", version: "1.0.2" },
		{ age: 60 * 1000, name: "release-age-leaf", version: "1.0.3" },
		{ age: 14 * day, name: "release-age-mature", version: "1.0.1" },
		{ age: day, name: "release-age-mature", version: "1.0.2" },
	];
	const archives = new Map<string, Uint8Array>();
	const manifests = new Map<string, Record<string, unknown>>();
	for (const release of releases) {
		const { name, version } = release;
		const source = join(root, `${name}-${version}`);
		yield* fs.makeDirectory(join(source, "package"), { recursive: true });
		const manifest = {
			dependencies: release.floor === undefined ? {} : { "release-age-leaf": release.floor, "release-age-mature": "^1.0.0" },
			main: "index.js",
			name,
			type: "module",
			version,
		};
		yield* writeJson(join(source, "package/package.json"), manifest);
		yield* fs.writeFileString(
			join(source, "package/index.js"),
			release.floor === undefined
				? `export default ${JSON.stringify(version)};\n`
				: `import fresh from "release-age-leaf";\nimport mature from "release-age-mature";\nexport default { parent: ${JSON.stringify(version)}, fresh, mature };\n`,
		);
		yield* command(source, "tar", ["-czf", "archive.tgz", "package"]);
		const key = `${name}/${version}`;
		archives.set(key, yield* fs.readFile(join(source, "archive.tgz")));
		manifests.set(key, manifest);
	}
	let url = "";
	function versionMetadata({ name, version }: { name: string; version: string }) {
		const key = `${name}/${version}`;
		return [
			version,
			{
				...manifests.get(key),
				dist: {
					shasum: createHash("sha1")
						.update(archives.get(key) ?? new Uint8Array())
						.digest("hex"),
					tarball: `${url}/archives/${key}`,
				},
			},
		];
	}
	function metadata(name: string | undefined) {
		const matching = releases.filter((release) => release.name === name);
		return {
			body: {
				"dist-tags": { latest: matching.at(-1)?.version },
				name,
				time: Object.fromEntries(matching.map(({ version, age }) => [version, new Date(now - age).toISOString()])),
				versions: Object.fromEntries(matching.map(versionMetadata)),
			},
		};
	}
	const server = yield* fakeHttpService({
		routes: {
			archive: { path: "/archives/:name/:version", reply: ({ params }) => ({ body: archives.get(`${params.name}/${params.version}`) }) },
			metadata: { path: "/:name", reply: ({ params }) => metadata(params.name) },
		},
	});
	url = server.url;
	return url;
});
