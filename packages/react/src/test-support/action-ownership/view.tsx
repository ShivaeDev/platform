import { RegistryProvider } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";
import { type ActionState, useAction } from "#client/resultState.ts";
import { causeWords } from "#test/outcomeWords.ts";
import type { CommandName, Mode, OwnershipClient } from "./client.ts";

export interface ControlProps {
	readonly client: OwnershipClient;
	readonly input: string;
	readonly name: CommandName;
}

function Control({ action, input, name }: ControlProps & { readonly action: ActionState<string, string, string> }) {
	const failure = AsyncResult.error(action.result);
	const alert = Option.isSome(failure) && <p role="alert">{failure.value}</p>;
	return (
		<>
			<button disabled={action.pending} onClick={() => action.dispatch(input)} type="button">
				{name}
			</button>
			{alert}
			<output>{Option.getOrElse(action.data, () => "")}</output>
			<p data-cause="">{causeWords(action.cause)}</p>
		</>
	);
}

function NativeControl(props: ControlProps) {
	return <Control {...props} action={useAction(props.client.commands[props.name].atom)} />;
}

function RuntimeControl(props: ControlProps) {
	const [feedback, present] = useState("");
	const action = useAction(props.client.runtime, props.client.commands[props.name].run, {
		onFailure: (error) => present(`${props.name}: ${error}`),
		onSuccess: (value) => present(`${props.name}: ${value}`),
	});
	return (
		<>
			<Control {...props} action={action} />
			<p role="status">{feedback}</p>
		</>
	);
}

export function OwnershipView({ mode, ...props }: ControlProps & { readonly mode: Mode }) {
	const View = mode === "native" ? NativeControl : RuntimeControl;
	return (
		<RegistryProvider>
			<View {...props} />
		</RegistryProvider>
	);
}
