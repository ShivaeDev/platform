import { cn } from "#client/react/lib/cn.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";

export function AnswerMarkdown({ className, file, source }: { readonly className?: string; readonly file: string; readonly source: string }) {
	return (
		<div
			className={cn(
				"[&_a]:underline [&_a]:underline-offset-4 [&_code]:font-mono [&_code]:text-[0.9em] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5",
				className,
			)}
		>
			<ResponseMarkdown file={file} source={source} />
		</div>
	);
}
