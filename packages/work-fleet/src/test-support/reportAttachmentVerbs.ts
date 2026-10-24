import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { boardReads } from "#test/boardReads.ts";

export function reportAttachmentVerbs(fixture: Effect.Success<ReturnType<typeof boardReads>>) {
	return {
		reportWithAttachments: (work: BoardWork, observation: SessionObservation) =>
			Effect.flatMap(BoardGateway, (board) => board.report(work, observation)).pipe(
				Effect.provide(
					reportBoard(
						fixture.root,
						() => Effect.succeed(false),
						() => Effect.succeed({ files: [{ bytes: Uint8Array.of(42), path: "evidence.txt" }], unavailable: [] }),
					).pipe(Layer.provide(fixture.board)),
				),
			),
		responseFiles: () => readdirSync(join(fixture.root, "responses")),
	};
}
