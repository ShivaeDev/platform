import { Effect } from "effect";
import type { ArtifactExtractionOptions } from "#artifactExtraction.ts";
import type { GitHub } from "#GitHub.ts";
import type { artifactFixture } from "./artifactFixture.ts";
import { answered } from "./outcome.ts";
import { type ArchiveEntry, zipArchive } from "./zipArchive.ts";

export function artifactVerbs(client: typeof GitHub.Service, archive: ReturnType<typeof artifactFixture>["state"], tell: (line: string) => void) {
	return {
		downloadExtracted: (options: ArtifactExtractionOptions = {}) => {
			tell("the client downloads and extracts artifact 7");
			return answered(client.downloadArtifactArchive({ artifactId: 7, byteLimit: 1024 * 1024, owner: "acme", repo: "widgets", ...options }));
		},
		writeArchive: (entries: readonly ArchiveEntry[]) =>
			Effect.sync(() => {
				tell(`storage holds a ZIP with entries ${entries.map(({ path }) => JSON.stringify(path)).join(", ")}`);
				archive.archive = { chunks: [zipArchive(entries)] };
			}),
		writeInvalidArchive: () =>
			Effect.sync(() => {
				tell("storage holds bytes that are not a ZIP");
				archive.archive = { chunks: ["not a ZIP"] };
			}),
	};
}
