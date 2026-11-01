import { join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

const Publication = Schema.fromJsonString(Schema.Struct({ name: Schema.String, versions: Schema.Record(Schema.String, Schema.Unknown) }));

export const releaseRegistry = Effect.fn("ReleaseRegistry.releaseRegistry")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const server = yield* fakeHttpService({
		routes: {
			lookup: { path: "/:path*", reply: () => ({ body: { error: "Not found" }, status: HttpStatus.fromLiteral("NotFound") }) },
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
		publications: () =>
			server.requests
				.filter(({ method }) => method === "PUT")
				.flatMap(({ body }) => {
					const publication = Schema.decodeUnknownSync(Publication)(body.toString());
					return Object.keys(publication.versions).map((version) => ({ name: publication.name, version }));
				}),
	};
});
