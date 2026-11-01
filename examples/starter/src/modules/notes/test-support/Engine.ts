import type { Effect } from "effect";
import type { PgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import type { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import type { HostOptions, RunningHost } from "#test-support/host.ts";
import type { NotesRequests } from "./requests.ts";

export interface Account {
	readonly cookie: string;
	readonly notes: NotesRequests;
	readonly userId: string;
}

export interface RpcAddress {
	readonly baseUrl: string;
	readonly origin: string;
}

export interface Engine {
	readonly accounts: Map<string, Account>;
	host: RunningHost | undefined;
	hostOptions: HostOptions;
	live: RpcAddress | undefined;
	readonly sourceApi: Effect.Success<ReturnType<typeof fakeHttpService>>;
	tell: (line: string) => void;
	traces: Effect.Success<ReturnType<typeof otlpReceiver>> | undefined;
	worker: { readonly jobs: PgBossTesting; readonly stop: Effect.Effect<void> } | undefined;
}
