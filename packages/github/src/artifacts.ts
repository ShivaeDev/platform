import { Effect } from "effect";
import type { ArtifactExtractionOptions } from "#artifactExtraction.ts";
import { initializeArtifacts } from "#initializeArtifacts.ts";
import { downloadArtifactArchive } from "#operations/downloadArtifactArchive.ts";
import type { RateLimits } from "#rateLimits.ts";

export interface ArtifactArchiveOptions extends ArtifactExtractionOptions {
	readonly artifactId: number;
	readonly byteLimit: number;
	readonly owner: string;
	readonly repo: string;
}

export function artifacts(apiUrl: string, rates: RateLimits) {
	return Effect.map(initializeArtifacts(apiUrl, rates), (state) => ({ downloadArtifactArchive: downloadArtifactArchive(state) }));
}
