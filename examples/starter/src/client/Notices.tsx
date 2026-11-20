import type { ReactNode } from "react";
import { type Notice, NoticeHost } from "@shivaedev/react/client/notices.ts";
import { Button } from "#client/ui/button.tsx";

function NoticeAction({ action }: { readonly action: Notice["action"] }) {
	if (action === undefined) {
		return null;
	}
	return (
		<Button disabled={action.pending} onClick={action.run} size="sm" variant="outline">
			{action.label}
		</Button>
	);
}

function NoticeCard(notice: Notice) {
	const tone = notice.kind === "success" ? "bg-card" : "border-destructive/40 bg-destructive/10 text-destructive";
	return (
		<div
			className={`mx-auto mb-2 flex w-full max-w-2xl items-center gap-3 rounded-lg border p-3 text-sm shadow-sm ${tone}`}
			role={notice.kind === "success" ? "status" : "alert"}
		>
			<p className="flex-1">{notice.message}</p>
			<NoticeAction action={notice.action} />
			<Button onClick={notice.dismiss} size="sm" variant="ghost">
				Dismiss
			</Button>
		</div>
	);
}

// Every command's and save's failure notice appears here, so the screens carry no failure wiring of their own.
export function Notices({ children }: { readonly children: ReactNode }) {
	return <NoticeHost render={NoticeCard}>{children}</NoticeHost>;
}
