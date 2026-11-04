import { Cause, type Crypto, Option, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useClock } from "#client/adapters/useClock.ts";
import { useNewId } from "#client/adapters/useNewId.ts";
import { usePromiseAction } from "#client/adapters/usePromiseAction.ts";
import type { ActionState } from "#client/resultState.ts";

class ClipboardDenied extends Schema.TaggedError<ClipboardDenied>()("ClipboardDenied", { reason: Schema.String }) {}

export interface Controls {
	readonly call: (text: string) => Promise<string>;
	readonly mapFailure: boolean;
	readonly runtime?: Atom.AtomRuntime<Crypto.Crypto> | undefined;
	readonly text: string;
}

export function View({ runtime, call, text, mapFailure }: Controls) {
	const newId = useNewId(runtime);
	const now = useClock(runtime);
	const [id] = useState(newId);
	const [initialTime] = useState(now);
	const [stamp, setStamp] = useState("");
	const options = { catch: (cause: unknown) => new ClipboardDenied({ reason: String(cause) }) };
	const mapped = usePromiseAction(() => call(text), options);
	const unknown = usePromiseAction(() => call(text));
	const action: ActionState<void, string, ClipboardDenied | Cause.UnknownError> = mapFailure ? mapped : unknown;
	const failure = Option.flatMap(action.cause, Cause.findErrorOption);
	return (
		<section>
			<output data-id>{id}</output>
			<output data-time>{initialTime}</output>
			<output data-stamp>{stamp}</output>
			<button onClick={() => setStamp(`${newId()}:${now()}`)} type="button">
				Stamp
			</button>
			<button onClick={() => action.dispatch()} type="button">
				Copy
			</button>
			<output data-result>{Option.getOrElse(action.data, () => "empty")}</output>
			<output data-pending>{String(action.pending)}</output>
			<output data-failure>
				{Option.match(failure, {
					onNone: () => "none",
					onSome: (error) => (error._tag === "ClipboardDenied" ? `${error._tag}:${error.reason}` : `${error._tag}:${error.cause}`),
				})}
			</output>
		</section>
	);
}
