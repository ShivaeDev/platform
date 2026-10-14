import { cva } from "class-variance-authority";
export const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
	{
		defaultVariants: { size: "default", variant: "default" },
		variants: {
			size: { default: "h-9 px-3 py-2", icon: "size-9 p-0", sm: "h-8 px-2" },
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				ghost: "border-0 bg-transparent hover:bg-accent hover:text-accent-foreground",
				outline: "border border-input bg-background text-foreground hover:bg-accent",
				secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			},
		},
	},
);
