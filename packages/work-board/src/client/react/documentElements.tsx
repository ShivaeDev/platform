import { cn } from "cn";
import type { Element } from "hast";
import type { Components } from "react-markdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";

function columnClass(node: Element | undefined) {
	return node?.properties.dataColumn === "prose" ? "min-w-[20ch] whitespace-normal" : undefined;
}

export const documentElements: Components = {
	table: ({ node: _node, ...props }) => <Table {...props} className="text-sm" data-markdown-table="" />,
	tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
	td: ({ node, ...props }) => <TableCell {...props} className={cn("align-top [overflow-wrap:normal]", columnClass(node))} />,
	th: ({ node, ...props }) => <TableHead {...props} className={cn("[overflow-wrap:normal]", columnClass(node))} />,
	thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
	tr: ({ node: _node, ...props }) => <TableRow {...props} />,
};
