import { Effect, Schema } from "effect";
import { Suspense } from "react";
import { useField } from "@shivaedev/form/adapters/react.ts";
import { useUndoableChange } from "#client/adapters/useUndoableChange.ts";
import { useCreate } from "#client/create.ts";
import { NoticeHost } from "#client/notices.ts";
import { QueryView, QueryViewDefaults } from "#client/QueryView.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { UnexpectedFailure } from "#client/unexpectedFailure.ts";
import type { FailureClient, SubtitleRejected } from "#test/failure-defaults/client.ts";

export interface FailureScreen {
	readonly client: FailureClient;
	readonly hostWording?: ((failure: UnexpectedFailure) => { readonly message: string }) | undefined;
	readonly queryDefaults: boolean;
	rechecks: number;
}

function ActionButton({ label, onClick, pending }: { readonly label: string; readonly onClick: () => void; readonly pending: boolean }) {
	return (
		<button data-pending={pending} onClick={onClick} type="button">
			{label}
		</button>
	);
}

function renamedFirst() {
	return { message: "Someone else renamed it first" };
}
function onTitle(error: SubtitleRejected) {
	return { field: "title" as const, message: error.message };
}
function quietly() {
	return "silent" as const;
}
function keptTitle(error: SubtitleRejected, input: { readonly title: string }) {
	return { message: `${input.title} kept its title: ${error.message}` };
}

// The deploy gate is open: these stories are about the change's failures, not a pending update.
const openGate = { block: Effect.succeed(() => undefined) };

// No hook here words a shared rejection, a lost connection or a defect: those reach the defaults.
function Commands({ client }: { readonly client: FailureClient }) {
	const renamed = useAction(client.api.rename, {
		failures: { SubtitleRejected: (error, input) => ({ message: `${input.title}: ${error.message}` }) },
	});
	const quiet = useAction(client.api.rename, { silent: true });
	const worded = useAction(client.api.rename, {
		failures: { Conflict: renamedFirst, SubtitleRejected: "silent" },
	});
	const offline = useAction(client.offline);
	const alsoOffline = useAction(client.offline);
	const dies = useAction(client.dies);
	const draft = { title: "Draft" };
	return (
		<>
			<ActionButton label="Rename" onClick={() => renamed.dispatch(draft)} pending={renamed.pending} />
			<ActionButton label="Rename quietly" onClick={() => quiet.dispatch(draft)} pending={quiet.pending} />
			<ActionButton label="Rename with its own wording" onClick={() => worded.dispatch(draft)} pending={worded.pending} />
			<ActionButton label="Rename offline" onClick={() => offline.dispatch(draft)} pending={offline.pending || alsoOffline.pending} />
			<ActionButton label="Rename with a dying server" onClick={() => dies.dispatch(draft)} pending={dies.pending} />
		</>
	);
}

function MoreCommands({ client }: { readonly client: FailureClient }) {
	const serverWords = useAction(client.api.rename, { failures: { SubtitleRejected: "message" } });
	const quietHandler = useAction(client.api.rename, { failures: { SubtitleRejected: quietly } });
	const outage = useAction(client.unavailable);
	const undoable = useUndoableChange(client.api.rename, {
		describe: (title) => `Renamed to ${title}`,
		failures: { SubtitleRejected: keptTitle },
		undoInput: (_title, input) => input,
		update: openGate,
	});
	const draft = { title: "Draft" };
	return (
		<>
			<ActionButton label="Rename with the server's words" onClick={() => serverWords.dispatch(draft)} pending={serverWords.pending} />
			<ActionButton label="Rename with a quiet handler" onClick={() => quietHandler.dispatch(draft)} pending={quietHandler.pending} />
			<ActionButton label="Rename during an outage" onClick={() => outage.dispatch(draft)} pending={outage.pending} />
			<ActionButton label="Rename with undo" onClick={() => undoable.remove(draft)} pending={undoable.pending} />
		</>
	);
}

function RenameForm({ client }: { readonly client: FailureClient }) {
	const create = useCreate(client.api.rename, {
		failures: { SubtitleRejected: onTitle },
		initialValues: { title: "Draft" },
	});
	const title = useField(create.form, "title");
	return (
		<form data-form="rename">
			<button data-pending={create.saving} onClick={create.save} type="button">
				Save form
			</button>
			<p data-field-error="">{title.error ?? ""}</p>
		</form>
	);
}

const Title = Schema.Struct({ title: Schema.String });

function DyingForm({ client }: { readonly client: FailureClient }) {
	const create = useCreate(client.dies, { fields: Title, initialValues: { title: "Draft" } });
	return (
		<button data-pending={create.saving} onClick={create.save} type="button">
			Save with a dying server
		</button>
	);
}

function Note({ client }: { readonly client: FailureClient }) {
	const note = useQuery(client.note);
	return <QueryView content={(title) => <p data-note="">{title}</p>} query={note} />;
}

function Screen({ state }: { readonly state: FailureScreen }) {
	const body = (
		<>
			<Commands client={state.client} />
			<MoreCommands client={state.client} />
			<RenameForm client={state.client} />
			<DyingForm client={state.client} />
			<Note client={state.client} />
		</>
	);
	return state.queryDefaults ? (
		<QueryViewDefaults failure={() => <p role="alert">This draft could not be opened</p>} loading={() => <p role="status">Fetching the draft</p>}>
			{body}
		</QueryViewDefaults>
	) : (
		body
	);
}

export function FailureDefaultsView({ state }: { readonly state: FailureScreen }) {
	return (
		<Suspense fallback="Loading">
			<SessionBoundary
				connect={() => state.client}
				identify={(session: string) => session}
				recheck={() => {
					state.rechecks += 1;
				}}
				session="alice"
			>
				{() => (
					<NoticeHost failure={state.hostWording}>
						<Screen state={state} />
					</NoticeHost>
				)}
			</SessionBoundary>
		</Suspense>
	);
}
