import { cn } from "cn";
import type { ComponentProps } from "react";

export function ReadingPanel({ className, ...props }: ComponentProps<"section">) {
	return (
		<section
			className={cn(
				"min-w-0 max-w-4xl space-y-6 [overflow-wrap:anywhere] [&_a:not([data-slot])]:underline [&_a:not([data-slot])]:underline-offset-4 [&_article]:rounded-lg [&_article]:border [&_article]:p-4 [&_code]:break-all [&_dd]:text-muted-foreground [&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:p-4 [&_dl]:grid [&_dl]:gap-2 [&_dt]:font-medium [&_h2]:mb-3 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-4 [&_pre]:max-h-96 [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_summary]:cursor-pointer [&_summary]:font-medium [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-5",
				className,
			)}
			{...props}
		/>
	);
}
