import { expect } from "@effect/vitest";
import { fleetAnswerHint, staleBoardPort } from "#test/answerHintStory.ts";

for (const mode of ["board", "port", "board and port"] as const) {
	fleetAnswerHint.it(
		`the printed answer command preserves ${mode} selection and answers the same worker`,
		mode === "board" ? [] : [staleBoardPort()],
		function* (daemon) {
			yield* daemon.dispatch();
			yield* daemon.question("Which storage should I use?");
			const selection = {
				...(mode === "port" ? {} : { board: daemon.board() }),
				...(mode === "board" ? {} : { port: daemon.port() }),
			};
			const status = yield* daemon.status(selection);
			expect(status).toMatchObject({ code: 0, stderr: "" });
			const hint =
				status.stdout
					.split("\n")
					.map((line) => line.trim())
					.find((line) => line.startsWith("work-fleet answer one")) ?? "";
			const text = "Use PostgreSQL and preserve the existing repository API.";
			const answer = yield* daemon.answer(hint, text);
			expect(answer).toMatchObject({ code: 0, stderr: "" });
			expect((yield* daemon.appliedAnswer()).responses).toMatchObject([{ action: "continue", boardAcknowledged: true }]);
			const resumed = yield* daemon.reconcile();
			expect(resumed.stage).toBe("executing");
			expect(resumed.attempts.at(-1)?.prompt).toBe(text);
			const board = ` --board '${daemon.board().replaceAll("'", "'\\''")}'`;
			const port = ` --port ${daemon.port()}`;
			const expectedSelection = { board, "board and port": `${board}${port}`, port };
			expect(hint).toBe(`work-fleet answer one${expectedSelection[mode]}`);
		},
	);
}
