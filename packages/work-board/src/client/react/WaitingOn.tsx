import { MessageCircleQuestion, Users } from "lucide-react";
import { itemAsks, waitsOnYou } from "#browser/document/asks.ts";
import type { Document, WaitingAsk } from "#browser/document/schema.ts";
import { responseUrl } from "#responses/url.ts";
import { LinkButton } from "./LinkButton.tsx";

const TOUCH = "pointer-coarse:h-11";

export function WaitingOn({ asks }: { readonly asks: readonly WaitingAsk[] }) {
	if (asks.length === 0) {
		return null;
	}
	return (
		<div>
			<ul aria-label="Waiting on" className="m-0 grid list-none gap-2 p-0">
				{asks.map((ask) => (
					<WaitingRow ask={ask} key={ask.answer} />
				))}
			</ul>
		</div>
	);
}

function WaitingRow({ ask }: { readonly ask: WaitingAsk }) {
	const you = ask.audience === "you";
	return (
		<li
			className={
				you
					? "flex items-center gap-3 rounded-lg border border-needs-you/40 bg-needs-you/10 px-3 py-2 text-sm"
					: "flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground text-sm"
			}
			data-waiting-on={ask.audience}
		>
			{you ? (
				<MessageCircleQuestion aria-hidden="true" className="size-4 shrink-0 text-needs-you" />
			) : (
				<Users aria-hidden="true" className="size-4 shrink-0" />
			)}
			<span className="min-w-0 flex-1">
				<span className="font-medium">{you ? "Waiting on you" : "Waiting on automation"}:</span>{" "}
				<a className="underline underline-offset-4" href={ask.href}>
					{ask.title}
				</a>
			</span>
			{you && (
				<LinkButton aria-label={`Answer ${ask.title}`} className={`${TOUCH} shrink-0`} href={ask.answer} variant="default">
					Answer
				</LinkButton>
			)}
		</li>
	);
}

// On a phone the answer card sits below the whole question; this jumps there and the passage scroll focuses its first control.
export function AnswerJump({ document }: { readonly document: Document }) {
	const request = itemAsks(document).find((entry) => entry.open && entry.preview !== undefined);
	if (document.metadata.kind !== "question" || !(request && document.identity)) {
		return null;
	}
	return (
		<LinkButton
			className={`${TOUCH} md:hidden`}
			data-answer-jump=""
			href={responseUrl(document.identity, request.id)}
			variant={waitsOnYou({ metadata: document.metadata, requests: [request] }) ? "default" : "outline"}
		>
			Answer
		</LinkButton>
	);
}
