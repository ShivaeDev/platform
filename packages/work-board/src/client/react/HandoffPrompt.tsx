import { Button } from "#client/react/components/ui/button.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { useCopy } from "#client/react/useCopy.ts";

export function HandoffPrompt({ id, prompt, prepared = false }: { readonly id: string; readonly prompt: string; readonly prepared?: boolean }) {
	const { fieldRef, handleCopy, status } = useCopy<HTMLTextAreaElement>(prompt, {
		copied: "Copied. Paste it into your agent session.",
		initial: prepared
			? "Saved. Copy this prompt into your agent session. The agent hasn't confirmed it yet."
			: "Paste this into your agent session. The Board doesn't message the agent.",
		selected: "prompt",
	});
	return (
		<div className="handoff-copy grid gap-2">
			<Label className="font-normal" htmlFor={`handoff-prompt-${id}`}>
				Prompt for your agent session
			</Label>
			<Textarea className="font-mono" id={`handoff-prompt-${id}`} readOnly ref={fieldRef} rows={3} value={prompt} />
			<div className="flex flex-wrap items-center gap-2">
				<Button data-handoff-copy={`handoff-prompt-${id}`} onClick={handleCopy} type="button">
					Copy prompt
				</Button>
				<p className="m-0 text-muted-foreground text-xs" data-copy-status role="status">
					{status}
				</p>
			</div>
		</div>
	);
}
