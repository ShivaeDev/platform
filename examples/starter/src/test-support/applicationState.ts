import type { Effect } from "effect";
import type { Note } from "#notes.ts";
import type { DatabaseLifetimeReadout } from "./DatabaseLifetime.ts";
import type { HostOptions, RunningHost } from "./host.ts";
import type { requests } from "./requests.ts";
import type { workerQueue } from "./workerQueue.ts";

export interface Actor {
	readonly cookie: string;
	readonly notes: Effect.Success<ReturnType<ReturnType<typeof requests>["notes"]>>;
	readonly userId: string;
}

export interface Engine {
	actors: Map<string, Actor>;
	readonly databaseLifetime: DatabaseLifetimeReadout;
	existingNotes: Map<string, Note>;
	host: RunningHost | undefined;
	hostOptions: HostOptions;
	tell: (line: string) => void;
	readonly workerQueue: ReturnType<typeof workerQueue>;
}
