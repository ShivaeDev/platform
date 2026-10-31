import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"receives a query result and live update through the development server's shared RPC WebSocket",
	[signedIn()],
	function* ({ actor, liveNotes, startDevelopment }) {
		yield* startDevelopment();

		const live = yield* liveNotes();
		expect(yield* live.nextNotes()).toEqual([]);

		const note = yield* actor().notes.create({ title: "A note through the dev proxy" });

		expect(yield* live.nextNotes()).toEqual([note]);
	},
);
