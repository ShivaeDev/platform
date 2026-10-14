import type { ReactElement } from "react";
import { cloneElement, useId } from "react";
export function Tooltip({ children, text }: { readonly children: ReactElement<{ readonly "aria-describedby"?: string }>; readonly text: string }) {
	const id = useId();
	return (
		<span className="group relative inline-flex">
			{cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" ") })}
			<span
				className="pointer-events-none absolute top-full right-0 z-50 mt-2 hidden w-max max-w-64 rounded-md bg-foreground px-2 py-1 text-background text-xs group-focus-within:block group-hover:block"
				id={id}
				role="tooltip"
			>
				{text}
			</span>
		</span>
	);
}
