import type { ArtifactExtractionOptions } from "#artifactExtraction.ts";

export interface ArtifactArchiveOptions extends ArtifactExtractionOptions {
	readonly artifactId: number;
	readonly byteLimit: number;
	readonly owner: string;
	readonly repo: string;
}
