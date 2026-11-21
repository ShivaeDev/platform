import { createMemoryHistory, type RouterHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type AppConnection, clientApp } from "#client/app.ts";
import { timesWords } from "#test/outcomeWords.ts";
import { type Answer, type LocalAnswer, type ReportBackend, reportProtocol } from "#test/query-failures/backend.ts";
import { Host, type Wording } from "#test/query-failures/Host.tsx";
import { reportsModule } from "#test/query-failures/reportsModule.tsx";
import { OwnFailureScreen } from "#test/query-failures/screens.tsx";
import { type Screen, screenWarnings } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";

interface State {
	readonly backend: ReportBackend;
	connection?: AppConnection;
	history?: RouterHistory;
	view?: Rendered;
}

function opened(state: State) {
	if (state.view === undefined || state.connection === undefined || state.history === undefined) {
		throw new Error("No report app is open; give the story an opened trait");
	}
	return { connection: state.connection, container: state.view.container };
}

function driver(state: State, screen: Screen) {
	const { connection, container } = opened(state);
	return screen.driver(container, activityScreenSignal(clientActivity(connection)));
}

function settled(state: State, screen: Screen, action: () => Effect.Effect<unknown>) {
	return Effect.suspend(action).pipe(Effect.andThen(Effect.suspend(() => driver(state, screen).settle())));
}

function texts(state: State, selector: string) {
	return [...opened(state).container.querySelectorAll(selector)].map((element) => element.textContent ?? "");
}

export const reportApps = storyKit(
	screenKit(
		"an app whose routes load a report",
		(): State => ({ backend: { answers: [], localAnswers: [], reads: 0, title: "Quarterly report" } }),
		(state, screen) => ({
			edit: (title: string) => settled(state, screen, () => driver(state, screen).enter({ name: "Title", role: "textbox" }, title)),
			heading: () => Effect.sync(() => opened(state).container.querySelector("h1")?.textContent ?? "no heading"),
			noticeActions: () => Effect.sync(() => texts(state, "[data-notice] > button")),
			// A notice's own paragraph holds its words; the buttons beside it are the host's.
			notices: () => Effect.sync(() => texts(state, "[data-notice] > p")),
			pressRefresh: () => settled(state, screen, () => driver(state, screen).click({ name: "Refresh", role: "button" })),
			pressRetry: () => settled(state, screen, () => driver(state, screen).click({ name: "Retry", role: "button" })),
			reads: () => Effect.sync(() => timesWords(state.backend.reads)),
			retryOffered: () => Effect.sync(() => texts(state, "button").includes("Retry")),
			screenFailure: () => Effect.sync(() => texts(state, "[role='alert']:not([data-notice])")),
			serverAnswers: (...answers: readonly Answer[]) =>
				Effect.sync(() => {
					screen.tell(`the server answers the next reads with ${answers.join(", then ")}`);
					state.backend.answers.push(...answers);
				}),
			serverRenames: (title: string) =>
				Effect.sync(() => {
					screen.tell(`the report is renamed to ${title} on the server`);
					state.backend.title = title;
				}),
			summaryAnswers: (...answers: readonly LocalAnswer[]) =>
				Effect.sync(() => {
					screen.tell(`the browser's next summary reads answer ${answers.join(", then ")}`);
					state.backend.localAnswers.push(...answers);
				}),
			title: () => Effect.sync(() => opened(state).container.querySelector<HTMLInputElement>("input[aria-label='Title']")?.value ?? "no title"),
		}),
	),
);

function outageWording(failure: { readonly kind: string }) {
	return { message: `Out of service (${failure.kind})` };
}

const WORDINGS = {
	"its default failure wording": {},
	"its failure host's own wording": { failure: outageWording },
	"its own failure screen for every route": { failure: outageWording, loadFailure: OwnFailureScreen },
} satisfies Record<string, Wording>;

export function openedAt(
	path: string,
	wording: keyof typeof WORDINGS = "its default failure wording",
	firstAnswer?: Answer | Exclude<LocalAnswer, "the summary">,
) {
	const first = firstAnswer === undefined ? "" : `, whose first read answers ${firstAnswer}`;
	return reportApps.trait("screen", `alice opens an app with ${wording} at ${path}${first}`, function* ({ screen, state }) {
		if (firstAnswer === "a defect" || firstAnswer === "an untagged failure") {
			state.backend.localAnswers.push(firstAnswer);
		} else if (firstAnswer !== undefined) {
			state.backend.answers.push(firstAnswer);
		}
		const app = clientApp([reportsModule(state.backend)], { protocol: reportProtocol(state.backend), url: "memory://report-app" });
		state.history = createMemoryHistory({ initialEntries: [path] });
		state.view = yield* screen.open(
			<Host
				app={{
					...app,
					connect: (session, registry) => {
						state.connection = app.connect(session, registry);
						return state.connection;
					},
				}}
				history={state.history}
				wording={WORDINGS[wording]}
			/>,
			// The route's error boundary catches the failed first read, as React reports to every boundary.
			firstAnswer === undefined ? undefined : { onCaughtError: screenWarnings.expectCaughtError(() => true) },
		);
		yield* driver(state, screen).settle();
	});
}
