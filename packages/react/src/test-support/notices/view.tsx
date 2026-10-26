import { Cause, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { StrictMode } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import { useCreate } from "#client/create.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { type Notice, NoticeHost } from "#notices.ts";
import type { NoticeClient } from "./client.ts";
import { EditorOperations } from "./EditorOperations.tsx";
import { Fields } from "./Fields.ts";

export interface NoticeScreen {
	readonly client: NoticeClient;
	readonly editor: boolean;
	readonly expiresIn?: number | undefined;
	readonly host: boolean;
	readonly queryFailure: boolean;
	readonly screens: boolean;
	readonly session: string;
	readonly uninterruptible: boolean;
}
export function NoticeCard(notice: Notice) {
	const action = notice.action;
	const result = action?.result;
	let outcome = "";
	if (result && AsyncResult.isFailure(result)) {
		outcome = Cause.pretty(result.cause);
	} else if (result && AsyncResult.isSuccess(result)) {
		outcome = String(result.value);
	}
	return (
		<article data-notice={notice.message}>
			<p>{notice.message}</p>
			{action !== undefined && (
				<button disabled={action.pending} onClick={action.run} type="button">
					{action.label}
				</button>
			)}
			<output>{outcome}</output>
			<button onClick={notice.dismiss} type="button">
				Dismiss {notice.message}
			</button>
		</article>
	);
}
const load = Atom.make(Effect.fail("Load unavailable"));
function Operations({ state }: { readonly state: NoticeScreen }) {
	const { client } = state;
	const list = useQuery(client.api.list.query(), { notice: ({ refreshing }) => ({ message: refreshing ? "Refresh failed" : "Load failed" }) });
	useQuery(load, { notice: () => (state.queryFailure ? { message: "Initial load failed" } : undefined) });
	const notices = {
		onFailure: () => ({ message: "Command failed" }),
		onSuccess: (removed: { readonly title: string; readonly expectedVersion: number }) => ({
			action: {
				label: `Undo ${removed.title}`,
				run: state.uninterruptible ? Effect.uninterruptible(client.api.restore.run(removed)) : client.api.restore.run(removed),
			},
			expiresIn: state.expiresIn,
			message: `Removed ${removed.title}`,
		}),
	};
	const remove = useAction(client.runtime, client.api.remove.run, { concurrent: true, notices });
	const edit = useAction(client.runtime, client.api.edit.run);
	const breakReads = useAction(client.runtime, client.api.breakReads.run);
	const form = useCreate({ create: client.api.remove.run, fields: Fields, initialValues: { title: "blocked" }, notices, runtime: client.runtime });
	const titleField = useField(form.form, "title");
	return (
		<>
			{["first", "second", "blocked"].map((title) => (
				<button key={title} onClick={() => remove.dispatch({ title })} type="button">
					Remove {title}
				</button>
			))}
			<button onClick={() => edit.dispatch({ title: "first" })} type="button">
				Edit first
			</button>
			<input name="title" onChange={(event) => titleField.onChange(event.target.value)} value={titleField.value} />
			<button onClick={() => breakReads.dispatch(undefined)} type="button">
				Break refresh
			</button>
			<button onClick={form.save} type="button">
				Submit form
			</button>
			<button onClick={list.refresh} type="button">
				Refresh
			</button>
			<output data-command="">
				{Option.getOrElse(
					Option.map(remove.data, (value) => value.title),
					() => "",
				)}
			</output>
			<output data-rows="">{Option.getOrElse(list.data, () => "")}</output>
		</>
	);
}
function Screens({ state }: { readonly state: NoticeScreen }) {
	return state.editor ? <EditorOperations client={state.client} /> : <Operations state={state} />;
}
export function NoticeView({ state }: { readonly state: NoticeScreen }) {
	return (
		<StrictMode>
			<SessionBoundary connect={() => state.client} identify={(id: string) => id} recheck={() => undefined} session={state.session}>
				{() =>
					state.host ? <NoticeHost render={NoticeCard}>{state.screens ? <Screens state={state} /> : null}</NoticeHost> : <Screens state={state} />
				}
			</SessionBoundary>
		</StrictMode>
	);
}
