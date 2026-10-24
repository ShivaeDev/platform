import type { Effect, Scope } from "effect";
import type { SqlClient } from "effect/sql";
import type { HostParts } from "#host/commands.ts";
import type { EngineProvider } from "#test/engineProvider.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import type { localBoardHost } from "#test/localBoardHost.ts";
import type { missingTurnTransport } from "#test/missingTurnTransport.ts";
import type { turnDownload } from "#test/reportAttachments.ts";
import type { HostDaemon } from "#test/startHostDaemon.ts";

export class HostStoryScenario {
	scheduled = false;
	runningParts: HostParts | undefined;
	reader: HostDaemon | undefined;
	reviews: string[] = [];
	deferStart = false;
	lostTurns: ReturnType<typeof missingTurnTransport> | undefined;
	diagnosticNow: number | undefined;
	acknowledgements: { unavailable: boolean; attempts: number } | undefined;
	now = 100;
	rejectSubmission = true;
	launch = { model: "initial-model" };
	providerFixture: EngineProvider | undefined;
	attachmentDownload: Effect.Success<ReturnType<typeof turnDownload>> | undefined;
	publicationRequests: string[] = [];
	localBoardOptions: Parameters<typeof localBoardHost>[1];
	board: ((fixture: HostFixture) => NonNullable<HostParts["board"]>) | undefined;
	policy: HostParts["policy"];
	beforeStart: ((fixture: HostFixture) => Effect.Effect<void, unknown, SqlClient.SqlClient | Scope.Scope>) | undefined;
}
