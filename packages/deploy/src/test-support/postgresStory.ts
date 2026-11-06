import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { DatabaseNode } from "railway/iac";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

interface DefinitionResult {
	database?: DatabaseNode;
	refused?: string;
	requests: string[];
}

export const postgres = storyKit({
	create: (): {
		scenario: {
			entrypoint?: string[];
			cmd?: string[];
			status?: number;
			singleManifest?: boolean;
		};
	} => ({ scenario: {} }),
	name: "Postgres definition",
	stages: ["registry"],
	verbs: (engine, story) => ({
		defineDatabase: (): DefinitionResult => {
			story.tell("define the database after inspecting the registry image");
			const output = execFileSync(
				process.execPath,
				["--conditions=@shivaedev/source", fileURLToPath(new URL("./registryRunner.ts", import.meta.url))],
				{ encoding: "utf8", input: JSON.stringify(engine.scenario) },
			);
			return JSON.parse(output);
		},
	}),
});

export const changedEntrypoint = postgres.trait("registry", "the arm64 image has a different entrypoint", ({ scenario }) => {
	scenario.entrypoint = ["/new-entrypoint"];
});
export const changedCmd = postgres.trait("registry", "the image has a different command", ({ scenario }) => {
	scenario.cmd = ["postgres"];
});
export const registryUnavailable = postgres.trait("registry", "the image registry returns HTTP 503", ({ scenario }) => {
	scenario.status = 503;
});
export const singleManifest = postgres.trait("registry", "the image has a single manifest", ({ scenario }) => {
	scenario.singleManifest = true;
});
