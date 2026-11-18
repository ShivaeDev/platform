import { RegistryProvider } from "@effect/atom-react";
import { CatchBoundary, type ErrorComponentProps } from "@tanstack/react-router";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { StrictMode, useState } from "react";
import { type ActionState, useAction } from "#client/resultState.ts";
import type { CommandName, Mode, OwnershipClient } from "#test/action-ownership/client.ts";
import { causeWords } from "#test/outcomeWords.ts";

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

function InlineRunControl(props: ControlProps) {
	const action = useAction(props.client.runtime, (input: string) => props.client.commands[props.name].run(input));
	return <Control {...props} action={action} />;
}

function Crash({ error }: ErrorComponentProps) {
	const message = error instanceof Error ? error.message : "an unknown failure";
	return <p data-crash="">{message}</p>;
}

const views = { "inline run": InlineRunControl, native: NativeControl, runtime: RuntimeControl };

export function OwnershipView({ mode, strict, ...props }: ControlProps & { readonly mode: Mode; readonly strict: boolean }) {
	const View = views[mode];
	const control = (
		<RegistryProvider>
			<CatchBoundary errorComponent={Crash} getResetKey={() => "control"}>
				<View {...props} />
			</CatchBoundary>
		</RegistryProvider>
	);
	return strict ? <StrictMode>{control}</StrictMode> : control;
}
