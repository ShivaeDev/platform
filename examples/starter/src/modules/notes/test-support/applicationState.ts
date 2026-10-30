import type { Effect } from "effect";
import type { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { HostOptions, RunningHost } from "#test-support/host.ts";
import type { requests } from "./requests.ts";
import type { workerQueue } from "./workerQueue.ts";

export interface Actor {
	readonly cookie: string;
	readonly notes: Effect.Success<ReturnType<ReturnType<typeof requests>["notes"]>>;
	readonly userId: string;
}

export interface Engine {
	actors: Map<string, Actor>;
	host: RunningHost | undefined;
	hostOptions: HostOptions;
	readonly sourceApi: Effect.Success<ReturnType<typeof fakeHttpService>>;
	tell: (line: string) => void;
	readonly workerQueue: ReturnType<typeof workerQueue>;
}
