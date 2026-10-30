import * as HttpStatus from "effect/http/HttpStatus";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authQuery } from "#client/authQuery.ts";
import { AuthRead } from "./AuthRead.tsx";
import { screenKit } from "./screenKit.ts";

interface AuthError {
	readonly code: "REFUSED";
	readonly status: number;
}
interface Response {
	data: string | null;
	error: AuthError | null;
}
interface State {
	readonly inputs: string[];
	query?: ReturnType<typeof authQuery<string, string | null, AuthError>>;
	reject?: (cause: unknown) => void;
	resolve?: (response: Response) => void;
	signal?: AbortSignal;
	view?: Rendered;
}

function current(state: State) {
	if (!(state.view && state.resolve && state.reject && state.signal)) {
		throw new Error("No pending auth read");
	}
	return { reject: state.reject, resolve: state.resolve, signal: state.signal, view: state.view };
}

export const authReads = storyKit(
	screenKit(
		"auth query screen",
		(): State => ({ inputs: [] }),
		(state, screen) => ({
			close: () => screen.act("unmount the pending auth read", () => current(state).view.unmount()),
			read: (input: string) =>
				screen.act("read another auth input", () => {
					if (!state.query) {
						throw new Error("No auth query family");
					}
					return current(state).view.render(<AuthRead query={state.query(input)} />);
				}),
			refuse: () =>
				screen.act("the auth read is refused", () =>
					current(state).resolve({ data: null, error: { code: "REFUSED", status: HttpStatus.fromLiteral("Forbidden") } }),
				),
			reject: () => screen.act("the auth connection rejects", () => current(state).reject("offline")),
			request: () => ({ aborted: current(state).signal.aborted, inputs: state.inputs }),
			succeed: (data: string) => screen.act("the auth read succeeds", () => current(state).resolve({ data, error: null })),
			text: () => current(state).view.container.textContent,
		}),
	),
);
export function pendingAuthRead() {
	return authReads.trait("screen", "an auth read is pending", function* ({ state, screen }) {
		const query = authQuery(
			(input: string, signal) =>
				new Promise<Response>((resolve, reject) => {
					state.inputs.push(input);
					state.signal = signal;
					state.resolve = resolve;
					state.reject = reject;
				}),
		);
		state.query = query;
		state.view = yield* screen.open(<AuthRead query={query("consent")} />);
	});
}
