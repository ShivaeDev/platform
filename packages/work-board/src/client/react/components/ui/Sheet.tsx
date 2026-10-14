import type { ComponentProps } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Modal } from "#client/react/Modal.tsx";
export function Sheet({ className, ...props }: ComponentProps<typeof Modal>) {
	return (
		<Modal
			className={cn(
				"fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-80 max-w-full overflow-y-auto border-l bg-background p-6 text-foreground shadow-xl backdrop:bg-black/45",
				className,
			)}
			{...props}
		/>
	);
}
