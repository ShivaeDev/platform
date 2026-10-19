import type { Components } from "react-markdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";

export const documentElements: Components = {
	table: ({ node: _node, ...props }) => <Table {...props} className="text-sm" />,
	tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
	td: ({ node: _node, ...props }) => <TableCell {...props} className="whitespace-normal align-top [overflow-wrap:normal]" />,
	th: ({ node: _node, ...props }) => <TableHead {...props} />,
	thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
	tr: ({ node: _node, ...props }) => <TableRow {...props} />,
};
