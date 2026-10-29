import { useEffect } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { shellIds } from "#client/react/shellIds.ts";
import { useCopy } from "#client/react/useCopy.ts";

export function HandoffPrompt({
	id,
	prompt,
	onStatus,
}: {
	readonly id: string;
	readonly prompt: string;
	readonly onStatus?: (text: string) => void;
}) {
	const prepared = onStatus !== undefined;
	const { fieldRef, handleCopy, status } = useCopy<HTMLTextAreaElement>(prompt, {
		copied: "Copied. Paste it into your agent session.",
		initial: "Paste this into your agent session. The Board doesn't message the agent.",
		onStatus,
		selected: "prompt",
	});
	useEffect(() => {
		const active = document.activeElement;
		// Preparing disables the submit button, which drops focus to the body; only then does the new prompt take it.
		if (prepared && (active === null || active === document.body || active.id === shellIds.handoffSubmit)) {
			fieldRef.current?.focus();
		}
	}, [prepared, fieldRef]);
	return (
		<div className="handoff-copy grid gap-2">
			<Label className="font-normal" htmlFor={`handoff-prompt-${id}`}>
				Prompt for your agent session
			</Label>
			<Textarea className="font-mono" id={`handoff-prompt-${id}`} readOnly ref={fieldRef} rows={3} value={prompt} />
			<div className="flex flex-wrap items-center gap-2">
				<Button data-handoff-copy={`handoff-prompt-${id}`} onClick={handleCopy} type="button" variant="outline">
					Copy prompt
				</Button>
				{!prepared && (
					<p className="text-muted-foreground m-0 text-xs" data-copy-status role="status">
						{status}
					</p>
				)}
			</div>
		</div>
	);
}
