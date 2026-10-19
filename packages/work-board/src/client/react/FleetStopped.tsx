import type { ReactNode } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "#client/react/components/ui/popover.tsx";

export function FleetStopped({ children, command, reason }: { readonly children?: ReactNode; readonly command: string; readonly reason: string }) {
	return (
		<div className="flex flex-col items-start gap-3 text-sm">
			<p className="m-0" role="status">
				{reason}
			</p>
			{children}
			<Popover>
				<PopoverTrigger render={<Button type="button" variant="outline" />}>How to start Fleet</PopoverTrigger>
				<PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] text-sm">
					<PopoverTitle>Start Fleet</PopoverTitle>
					<PopoverDescription>Run this in a terminal to start Fleet for this Board.</PopoverDescription>
					<pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-foreground text-xs">
						<code className="select-all">{command}</code>
					</pre>
				</PopoverContent>
			</Popover>
		</div>
	);
}
