import { useEffect, useRef, useState } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { copyText } from "./copyText.ts";
import { shellIds } from "./shellIds.ts";

export function HandoffPrompt({
	id,
	prompt,
	onStatus,
}: {
	readonly id: string;
	readonly prompt: string;
	readonly onStatus?: (text: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [status, setStatus] = useState("Paste this into your agent session. The Board doesn't message the agent.");
	const report = onStatus ?? setStatus;
	const prepared = onStatus !== undefined;
	useEffect(() => {
		const active = document.activeElement;
		// Preparing disables the submit button, which drops focus to the body; only then does the new prompt take it.
		if (prepared && (active === null || active === document.body || active.id === shellIds.handoffSubmit)) {
			ref.current?.focus();
		}
	}, [prepared]);
	async function handleCopy() {
		if (await copyText(prompt)) {
			report("Copied. Paste it into your agent session.");
			return;
		}
		ref.current?.focus();
		ref.current?.select();
		report("Couldn't copy automatically. The prompt is selected, so copy it yourself.");
	}
	return (
		<div className="handoff-copy grid gap-2">
			<Label className="font-normal" htmlFor={`handoff-prompt-${id}`}>
				Prompt for your agent session
			</Label>
			<Textarea className="font-mono" id={`handoff-prompt-${id}`} readOnly ref={ref} rows={3} value={prompt} />
			<div className="flex flex-wrap items-center gap-2">
				<Button data-handoff-copy={`handoff-prompt-${id}`} onClick={handleCopy} type="button" variant="outline">
					Copy prompt
				</Button>
				{!prepared && (
					<p className="m-0 text-muted-foreground text-xs" data-copy-status role="status">
						{status}
					</p>
				)}
			</div>
		</div>
	);
}
