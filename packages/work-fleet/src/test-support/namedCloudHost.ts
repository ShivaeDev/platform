import { Effect, Layer, Schema } from "effect";
import { fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { hostProvider } from "#host/providers.ts";
import { hostSql } from "#host/runtime.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { SessionService } from "#session/service.ts";
import { codexServer, WireRejection, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudThread, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { prepared } from "#test/preparation.ts";
import { storeState } from "#test/storeState.ts";

const Params = Schema.Struct({ name: Schema.optional(Schema.String), threadId: Schema.String });
export function namedRecord(workId: string, attempts: readonly Attempt[], context = "# Readable title"): FleetRecord {
	return {
		attempts,
		boardContext: context,
		boardRevision: "synthetic-revision",
		cwd: SYNTHETIC_WORKSPACE,
		preparation: prepared(),
		prompt: "Synthetic work",
		stage: "executing",
		workId,
	};
}
export function namedAttempt(role: Attempt["role"], sessionId?: string): Attempt {
	return {
		operationId: `synthetic-${role}`,
		role,
		...(sessionId === undefined ? {} : { sessionId }),
		status: "submitting",
		submittedAt: 1,
	};
}

export interface NamedHost extends HostFixture {
	readonly failures: Set<string>;
	readonly names: Map<string, string | null>;
	readonly requests: readonly WireRequest[];
	readonly sessions: Layer.Layer<typeof SessionService.Identifier, unknown>;
	readonly store: (record: FleetRecord) => Effect.Effect<void>;
}

function threadMetadata(request: WireRequest, names: Map<string, string | null>, failures: ReadonlySet<string>) {
	const params = Schema.decodeUnknownSync(Params)(request.params);
	if (failures.has(`${request.method}:${params.threadId}`)) {
		return new WireRejection("Synthetic naming failure");
	}
	if (request.method === "thread/name/set") {
		names.set(params.threadId, params.name ?? null);
		return {};
	}
	return { thread: { ...cloudThread().thread, id: params.threadId, name: names.get(params.threadId) ?? null } };
}

export function withNamedCloudHost<A, E>(prefix: string | undefined, use: (fixture: NamedHost) => Effect.Effect<A, E>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const names = new Map<string, string | null>();
			const failures = new Set<string>();
			const requests: WireRequest[] = [];
			const backend = yield* codexServer((request) => {
				requests.push(request);
				if (request.method === "thread/start") {
					const id = `synthetic-session-${names.size}`;
					names.set(id, null);
					return { thread: { id } };
				}
				if (request.method === "thread/read" || request.method === "thread/name/set") {
					return threadMetadata(request, names, failures);
				}
				return request.method === "turn/start" ? { turn: { id: "synthetic-turn" } } : {};
			});
			const authFile = yield* authFolder(syntheticToken("naming", FUTURE_EXPIRY));
			return yield* withHost(
				{ "work.md": task("synthetic-work", "approved", "Synthetic body").replace("# synthetic-work", "# Readable title") },
				{
					cloud: {
						authFile,
						cwd: SYNTHETIC_WORKSPACE,
						endpoint: backend.endpoint,
						environmentId: SYNTHETIC_ENVIRONMENT,
						...(prefix === undefined ? {} : { threadNamePrefix: prefix }),
					},
					provider: "cloud",
					worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
				},
				(fixture) => {
					const repository = postgresFleetRepository(fixture.host.namespace).pipe(Layer.provide(hostSql(fixture.host)));
					return use({
						...fixture,
						failures,
						names,
						requests,
						sessions: SessionService.layer.pipe(Layer.provide([fleetSessionJournal.pipe(Layer.provide(repository)), hostProvider(fixture.host)])),
						store: (record) => storeState(fixture.host, record.workId, record),
					});
				},
			);
		}),
	);
}
