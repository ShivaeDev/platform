import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpReply, FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { zipArchive } from "./zipArchive.ts";

export const ARCHIVE = zipArchive([{ content: "Artifact report\n", path: "report.txt" }]);

export function artifactFixture(origin: () => string) {
	const state: { redirect: FakeHttpReply | undefined; archive: FakeHttpReply } = {
		archive: { chunks: [ARCHIVE.slice(0, 4), ARCHIVE.slice(4)] },
		redirect: undefined,
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
