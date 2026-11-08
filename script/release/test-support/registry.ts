import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { vi } from "vitest";
import { type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

const Publication = Schema.fromJsonString(
	Schema.Struct({
		attachments: Schema.Record(Schema.String, Schema.Struct({ data: Schema.String })),
		name: Schema.String,
		versions: Schema.Record(Schema.String, Schema.Unknown),
	}).pipe(Schema.encodeKeys({ attachments: "_attachments" })),
);

export const foreignMachine = Effect.fn("ReleaseRegistry.foreignMachine")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const foreign = yield* fakeHttpService({
		routes: {
			lookup: { path: "/:path*", reply: () => ({ body: { error: "Not found" }, status: HttpStatus.fromLiteral("NotFound") }) },
			publish: { method: "PUT", path: "/:path*", reply: () => ({ body: { ok: true } }) },
		},
	});
	const home = yield* fs.makeTempDirectoryScoped({ prefix: "release-foreign-machine-" });
	const config = `@shivaedev:registry=${foreign.url}/\n//${new URL(foreign.url).host}/:_authToken=\${NPM_TOKEN}\n`;
	yield* fs.makeDirectory(join(home, "pnpm"));
	yield* fs.writeFileString(join(home, "pnpm/auth.ini"), config);
	yield* fs.writeFileString(join(home, ".npmrc"), config);
	vi.stubEnv("HOME", home);
	vi.stubEnv("NPM_TOKEN", "foreign-token");
	vi.stubEnv("pnpm_config_registry", `${foreign.url}/`);
	vi.stubEnv("XDG_CONFIG_HOME", home);
	yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
	return foreign;
});

export const releaseRegistry = Effect.fn("ReleaseRegistry.releaseRegistry")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const manifests = new Map<string, Readonly<Record<string, unknown>>>();
	const published = new Map<string, string[]>([
		["@shivaedev/platform", ["0.15.0"]],
		["@shivaedev/create-app", ["0.9.0"]],
	]);
	function lookup({ path }: FakeHttpRequest) {
		const name = decodeURIComponent(path.slice(1));
		const versions = published.get(name);
		if (versions === undefined) {
			return { body: { error: "Not found" }, status: HttpStatus.fromLiteral("NotFound") };
		}
		return {
			body: {
				"dist-tags": { latest: versions.at(-1) },
				name,
				time: Object.fromEntries(versions.map((version) => [version, "2026-01-01T00:00:00.000Z"])),
				versions: Object.fromEntries(
					versions.map((version) => [
						version,
						{ dist: { tarball: `https://registry.example.test/${version}.tgz` }, name, version, ...manifests.get(`${name}@${version}`) },
					]),
				),
			},
		};
	}
	const server = yield* fakeHttpService({
		routes: {
			lookup: { path: "/:path*", reply: lookup },
			publish: { method: "PUT", path: "/:path*", reply: () => ({ body: { ok: true } }) },
		},
	});
	const authority = new URL(server.url).host;
	yield* fs.writeFileString(
		join(root, ".npmrc"),
		`registry=${server.url}/\n//${authority}/:_authToken=release-stories\nmanage-package-manager-versions=false\npackage-manager-strict=false\n`,
	);
	yield* fs.writeFileString(join(root, ".git/info/exclude"), ".npmrc\n", { flag: "a" });
	return {
		alreadyPublished: (name: string, version: string) => published.set(name, [...(published.get(name) ?? []), version]),
		authorizations: () => server.requests.filter(({ method }) => method === "PUT").map(({ headers }) => headers.authorization),
		file: Effect.fn("ReleaseRegistry.file")(function* (name: string, path: string) {
			for (const request of server.requests.filter(({ method }) => method === "PUT")) {
				const publication = Schema.decodeUnknownSync(Publication)(request.body.toString());
				if (publication.name !== name) {
					continue;
				}
				const attachment = Object.values(publication.attachments)[0];
				if (attachment === undefined) {
					throw new Error(`No tarball published for ${name}.`);
				}
				return execFileSync("tar", ["-xzOf", "-", `package/${path}`], { encoding: "utf8", input: Buffer.from(attachment.data, "base64") });
			}
			throw new Error(`No publication for ${name}.`);
		}),
		frameworkPublished: (name: string, version: string, manifest: Readonly<Record<string, unknown>>) => {
			published.set(name, [...(published.get(name) ?? []), version]);
			manifests.set(`${name}@${version}`, manifest);
		},
		publications: () =>
			server.requests
				.filter(({ method }) => method === "PUT")
				.flatMap(({ body }) => {
					const publication = Schema.decodeUnknownSync(Publication)(body.toString());
					return Object.keys(publication.versions).map((version) => ({ name: publication.name, version }));
				}),
	};
});
