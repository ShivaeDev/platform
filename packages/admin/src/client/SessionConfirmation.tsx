import type { SignedInSession } from "@shivaedev/identity/sessions.ts";

export function SessionConfirmation({
	selected,
	currentSessionId,
	pending,
	onCancel,
	onConfirm,
}: {
	readonly selected: typeof SignedInSession.Type | undefined;
	readonly currentSessionId: string | undefined;
	readonly pending: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: (input: { readonly id: string }) => void;
}) {
	if (selected === undefined) {
		return null;
	}
	return (
		<fieldset aria-label="Confirm session revocation" className="min-w-0 space-y-3 rounded-md border p-4 wrap-anywhere">
			<p>{`End the session for ${selected.user.email}?${selected.id === currentSessionId ? " This signs you out." : ""}`}</p>
			<div className="flex flex-wrap gap-3">
				<button className="rounded-md border px-3 py-2" disabled={pending} onClick={onCancel} type="button">
					Cancel
				</button>
				<button className="rounded-md border px-3 py-2" disabled={pending} onClick={() => onConfirm({ id: selected.id })} type="button">
					{pending ? "Revoking…" : "Confirm revoke"}
				</button>
			</div>
		</fieldset>
	);
}
