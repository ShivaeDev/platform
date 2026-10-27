import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply, FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";

export function artifactFixture(origin: () => string) {
	const state: { redirect: FakeHttpReply | undefined; archive: FakeHttpReply; sentBytes: number } = {
		archive: { chunks: [new Uint8Array([80, 75, 3, 4]), new Uint8Array([0, 255, 10, 13])] },
		redirect: undefined,
		sentBytes: 0,
	};
	const routes = {
		archive: {
			path: "/storage/archive.zip",
			reply: () => state.archive,
		},
		artifactRedirect: {
			path: "/repos/acme/widgets/actions/artifacts/7/zip",
			reply: () =>
				state.redirect ?? {
					headers: { Location: `${origin()}/storage/archive.zip?signature=storage-secret` },
					status: HttpStatus.fromLiteral("Found"),
				},
		},
	} satisfies Record<string, FakeHttpRoute>;
	return { routes, state };
}
