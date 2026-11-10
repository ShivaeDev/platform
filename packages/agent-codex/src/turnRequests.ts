import { Effect } from "effect";
import { UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { ImageInput, Input } from "@shivaedev/agent/run.ts";
import { AppServer } from "#adapters/server.ts";
import { TurnResponse } from "#protocol.ts";
import { decode } from "#reads.ts";

function userInput(input: ImageInput) {
	return input.parts.map((part) =>
		part.type === "text" ? { text: part.text, "text_elements": [], type: "text" } : { path: part.path, type: "localImage" },
	);
}
export const turnRequests = Effect.fn("Codex.turnRequests")(function* (threadId: string, settings: { model?: string; effort?: string }) {
	const server = yield* AppServer;
	return {
		interrupt: (turnId: string) =>
			server.request("turn/interrupt", { threadId, turnId }, turnId).pipe(
				Effect.as("draining" as const),
				Effect.catchTag("Rejected", (error) => {
					if (error.message.includes("no active turn")) {
						return Effect.succeed("inactive" as const);
					}
					if (error.message.includes("timeout waiting")) {
						return Effect.succeed("draining" as const);
					}
					return Effect.fail(error);
				}),
			),
		start: (input: ImageInput, operationId: string) =>
			server.request("turn/start", { clientUserMessageId: operationId, input: userInput(input), threadId, ...settings }, operationId).pipe(
				Effect.flatMap((value) =>
					decode(TurnResponse, value).pipe(
						Effect.mapError(
							() => new UnknownAcceptance({ backend: "codex", message: "Codex accepted a mutation but returned no readable turn", operationId }),
						),
					),
				),
				Effect.map(({ turn }) => turn.id),
			),
		steer: (expectedTurnId: string, input: Input, operationId: string) =>
			server
				.request("turn/steer", { clientUserMessageId: operationId, expectedTurnId, input: userInput(input), threadId }, operationId)
				.pipe(Effect.asVoid),
	};
});
