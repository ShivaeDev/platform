import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { HostSettings } from "#host/config.ts";
import { task } from "#test/fleetHost.ts";
import { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostVerbs } from "#test/hostVerbs.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { statusRecord } from "#test/status.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const hostDefinition = {
	after: { configuration: (engine: HostStoryEngine) => engine.deploy() },
	around: withIsolatedDatabase,
	clock: "live" as const,
	create: () => new HostStoryEngine(),
	inspect: (engine: HostStoryEngine) => engine.inspect(),
	layer,
	name: "Fleet host",
	runIf: postgresEnabled,
	stages: ["configuration", "observation"] as const,
	verbs: (engine: HostStoryEngine, story: { tell: (line: string) => void }) => hostVerbs(engine, story.tell),
};

export const host = storyKit(hostDefinition);

export function boardWork(files: Readonly<Record<string, string>>, config: Partial<HostSettings> = {}) {
	return host.trait("configuration", `Board work in ${Object.keys(files).join(", ")}`, (engine) => {
		Object.assign(engine.files, files);
		Object.assign(engine.config, config);
	});
}

export function approvedWork(ids: readonly string[], body?: string) {
	return boardWork(Object.fromEntries(ids.map((id) => [`${id}.md`, task(id, "approved", body)])));
}

export const localOnlyBoard = host.trait("configuration", "the Board lives in a Git-ignored folder that Cloud workers cannot read", (engine) => {
	engine.localBoard = true;
});

// Recovery and status stories start from durable records that predate this daemon.
export function storedWork(workId: string, step: Parameters<typeof statusRecord>[1], fields: Readonly<Record<string, unknown>> = {}) {
	return host.trait("configuration", `${workId} is stored in ${step}`, (engine) => {
		engine.stored[workId] = { ...statusRecord(workId, step), ...fields };
	});
}
