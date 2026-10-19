import type { ReactNode } from "react";
import { CopyButton } from "#client/react/CopyButton.tsx";
import { Button } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { useCopy } from "#client/react/useCopy.ts";

export function FleetStopped({ children, command, reason }: { readonly children?: ReactNode; readonly command: string; readonly reason: string }) {
	return (
		<div className="flex flex-col items-start gap-3 text-sm">
			<p className="m-0" role="status">
				{reason}
			</p>
			{children}
			<FleetStartHelp command={command} />
		</div>
	);
}

export function FleetStartHelp({ command }: { readonly command: string }) {
	return (
		<Popover>
			<PopoverTrigger render={<Button type="button" variant="outline" />}>How to start Fleet</PopoverTrigger>
			<PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] text-sm">
				<PopoverTitle>Start Fleet</PopoverTitle>
				<PopoverDescription>Run this in a terminal, in the folder you started the Board from.</PopoverDescription>
				<StartCommand command={command} />
			</PopoverContent>
		</Popover>
	);
}

function StartCommand({ command }: { readonly command: string }) {
	const { fieldRef, handleCopy, status } = useCopy<HTMLTextAreaElement>(command, { copied: "Copied.", selected: "command" });
	return (
		<div className="grid gap-2">
			<div className="flex items-start gap-2">
				{/* A wrapping field shows the whole command on a phone; a one-line input opens scrolled to its end. */}
				<Textarea
					aria-label="Command to start Fleet"
					className="min-h-0 break-all font-mono text-xs"
					readOnly
					ref={fieldRef}
					rows={1}
					value={command}
				/>
				<CopyButton aria-label="Copy the command to start Fleet" onClick={handleCopy} />
			</div>
			<p className={status ? "m-0 text-muted-foreground text-xs" : "sr-only"} data-copy-status role="status">
				{status}
			</p>
		</div>
	);
}
