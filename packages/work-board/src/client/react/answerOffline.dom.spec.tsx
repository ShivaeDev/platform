import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const REASON = "Reconnecting to the Board. You can answer once it is back.";
const DRAFT = "Share one pool per worker.";
const ANSWER = { name: "Your answer", role: "textbox" };
const RECORD = { name: "Record answer", role: "button" };

screenStory.it(
	"holds the item page answer card while the Board reconnects and keeps the draft",
	[
		screenWorkspace("offline-answer"),
		routedScreen({ ...textQuestionFixture }, `/_board/item/${TEXT_QUESTION_ID}/`, { home: "home.md", writable: true }),
	],
	function* ({ answerInput, dropLiveConnection, findElement, readDisabled, readText, reconnectLive, roles }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		answerInput("body", DRAFT);
		yield* Effect.promise(dropLiveConnection);
		yield* Effect.promise(() => eventually(() => expect(readText("#response-form [role='status']")).toBe(REASON)));
		const answer = yield* roles.find(ANSWER);
		const record = yield* roles.find(RECORD);
		expect([readDisabled(answer), readDisabled(record)]).toEqual([true, true]);
		yield* Effect.promise(reconnectLive);
		yield* Effect.promise(() => eventually(() => expect([readDisabled(answer), readDisabled(record)]).toEqual([false, false])));
		expect(readText("#response-form")).not.toContain(REASON);
		expect(findElement<HTMLTextAreaElement>("#response-form textarea")?.value).toBe(DRAFT);
	},
);
