import { Effect } from "effect";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "#client/react/components/ui/tooltip.tsx";

export function ItemId({ id, href }: { readonly id: string; readonly href: string | undefined }) {
	const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
	const label = { copied: "Copied item ID", failed: "Copy failed; select the ID instead", idle: "Copy item ID" }[copy];
	function copyId() {
		void Effect.runPromise(
			Effect.tryPromise(() => navigator.clipboard.writeText(id)).pipe(
				Effect.match({ onFailure: () => setCopy("failed"), onSuccess: () => setCopy("copied") }),
			),
		);
	}
	return (
		<span className="inline-flex items-center gap-0.5 text-muted-foreground">
			<a className="select-all font-mono text-xs hover:text-foreground" href={href}>
				{id}
			</a>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button aria-label={label} onBlur={() => setCopy("idle")} onClick={copyId} size="icon-xs" type="button" variant="ghost">
							{copy === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
						</Button>
					}
				/>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</span>
	);
}
