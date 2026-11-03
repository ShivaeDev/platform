import { Effect, Option, Schema } from "effect";
import { InitializeResponse } from "#adapters/protocol.ts";
import type { Request } from "#adapters/Request.ts";

const CLIENT_INFO = { name: "platform_agent_codex", title: "Platform Codex", version: "0.0.0" };

export const MUTED_NOTIFICATIONS = [
	"item/agentMessage/delta",
	"item/commandExecution/outputDelta",
	"item/fileChange/outputDelta",
	"item/fileChange/patchUpdated",
	"item/plan/delta",
	"item/reasoning/summaryPartAdded",
	"item/reasoning/summaryTextDelta",
	"item/reasoning/textDelta",
	"turn/diff/updated",
];

const decodeInitialize = Schema.decodeUnknownOption(InitializeResponse);

function versionOf(response: unknown): Option.Option<string> {
	return Option.map(decodeInitialize(response), ({ userAgent }) => userAgent.split(" ")[0]?.split("/")[1] ?? "");
}

// Codex requires one initialize followed by initialized, with experimentalApi enabled for dynamic tools.
export function handshake(request: Request) {
	return request("initialize", {
		capabilities: {
			experimentalApi: true,
			optOutNotificationMethods: MUTED_NOTIFICATIONS,
			requestAttestation: false,
		},
		clientInfo: CLIENT_INFO,
	}).pipe(Effect.map(versionOf));
}
