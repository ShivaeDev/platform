import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authQuery } from "#client/authQuery.ts";
import { type AuthError, AuthRead } from "./AuthRead.tsx";
import { screenKit } from "./screenKit.ts";

interface Response {
	readonly data: string | null;
	readonly error: AuthError | null;
}
interface Request {
	readonly input: string;
	readonly reject: (cause: unknown) => void;
	readonly resolve: (response: Response) => void;
	readonly signal: AbortSignal;
}
interface State {
	readonly query: ReturnType<typeof authQuery<string, string | null, AuthError>>;
	readonly requests: Request[];
	view?: Rendered;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("No auth read is open");
	}
	return state.view;
}
function latest(state: State) {
	const request = state.requests.at(-1);
	if (!request) {
		throw new Error("No auth read reached the auth client");
	}
	return request;
}

export const authReads = storyKit(
	screenKit(
		"auth query screen",
		(): State => {
			const requests: Request[] = [];
			const query = authQuery(
				(input: string, signal) => new Promise<Response>((resolve, reject) => requests.push({ input, reject, resolve, signal })),
			);
			return { query, requests };
		},
		(state, screen) => ({
			authAnswers: (data: string) => screen.act(`the auth client answers ${data}`, () => latest(state).resolve({ data, error: null })),
			authRefuses: () =>
				screen.act("the auth client returns its REFUSED error", () =>
					latest(state).resolve({ data: null, error: { code: "REFUSED", status: HttpStatus.fromLiteral("Forbidden") } }),
				),
			closeScreen: () => screen.act("close the screen", () => view(state).unmount()),
			connectionRejects: (reason: string) => screen.act(`the auth connection rejects with ${reason}`, () => latest(state).reject(reason)),
			consentRead: () => Effect.sync(() => (latest(state).signal.aborted ? "aborted" : "open")),
			requestedInputs: () => Effect.sync(() => state.requests.map(({ input }) => input)),
			shown: () => Effect.sync(() => view(state).container.textContent),
			showRead: (input: string) => screen.act(`show the auth read for ${input}`, () => view(state).render(<AuthRead query={state.query(input)} />)),
		}),
	),
);

export function consentReadIsOpen() {
	return authReads.trait(
		"screen",
		"the screen shows the auth read for consent, which the auth client has not answered",
		function* ({ state, screen }) {
			state.view = yield* screen.open(<AuthRead query={state.query("consent")} />);
		},
	);
}

export function consentReadAnswered(data: string) {
	return authReads.trait("screen", `the screen shows the auth read for consent, answered with ${data}`, function* ({ state, screen }) {
		state.view = yield* screen.open(<AuthRead query={state.query("consent")} />);
		yield* screen.act(`the auth client answers ${data}`, () => latest(state).resolve({ data, error: null }));
	});
}
