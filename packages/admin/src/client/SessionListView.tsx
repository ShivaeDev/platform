import { DateTime } from "effect";
import type { SignedInSession } from "@shivaedev/identity/sessions.ts";

interface SessionControls {
	readonly currentSessionId: string | undefined;
	readonly pending: boolean;
	readonly select: (session: typeof SignedInSession.Type) => void;
}

export function SessionListView({ sessions, ...controls }: SessionControls & { readonly sessions: readonly (typeof SignedInSession.Type)[] }) {
	if (sessions.length === 0) {
		return <p>No signed-in sessions.</p>;
	}
	return (
		<ul aria-label="Sessions" className="grid min-w-0 gap-4">
			{sessions.map((session) => (
				<SessionRow {...controls} key={session.id} session={session} />
			))}
		</ul>
	);
}

function SessionRow({ session, currentSessionId, pending, select }: SessionControls & { readonly session: typeof SignedInSession.Type }) {
	const current = session.id === currentSessionId && <p className="font-medium">Your current session</p>;
	return (
		<li className="min-w-0 space-y-3 rounded-md border p-4 wrap-anywhere">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="font-medium">{session.user.name}</p>
					<p>{session.user.email}</p>
					{current}
				</div>
				<button
					aria-label={`Revoke session for ${session.user.email}`}
					className="rounded-md border px-3 py-2 disabled:opacity-50"
					disabled={pending}
					onClick={() => select(session)}
					type="button"
				>
					Revoke session
				</button>
			</div>
			<SessionTimes session={session} />
		</li>
	);
}

function SessionTimes({ session }: { readonly session: typeof SignedInSession.Type }) {
	const times = [
		["Started", session.startedAt],
		["Last activity", session.lastActivityAt],
		["Expires", session.expiresAt],
	] as const;
	return (
		<dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
			{times.map(([label, time]) => (
				<div key={label}>
					<dt className="text-muted-foreground">{label}</dt>
					<dd>
						<time dateTime={DateTime.formatIso(time)}>{DateTime.formatIso(time)}</time>
					</dd>
				</div>
			))}
		</dl>
	);
}
