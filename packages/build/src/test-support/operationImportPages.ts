// Pages whose script reaches operation.ts by each way a file can take its names, and Platform's own client code that reaches it.

const PAGE_IMPORTING_BILLING = `import { Billing } from "#modules/billing/contract.ts";

console.log(Billing);
`;

function billingContractTaking(imports: string, query: string): string {
	return `import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
${imports}

const List = ${query}("list", { reads: () => [], success: Schema.Array(Schema.String) });

export const Billing = contract("billing", { queries: [List] });
`;
}

export const operationImportPages = {
	"a contract that imports only stream from operation.ts": {
		"src/client.ts": `import { Ticks } from "#modules/ticks/contract.ts";

console.log(Ticks);
`,
		"src/modules/ticks/contract.ts": `import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { stream } from "@shivaedev/contract/operation.ts";

export const Ticks = contract("ticks", { streams: [stream("watch", { reads: () => [], success: Schema.String })] });
`,
	},
	"a contract that imports operation.ts as a namespace": {
		"src/client.ts": PAGE_IMPORTING_BILLING,
		"src/modules/billing/contract.ts": billingContractTaking('import * as Operation from "@shivaedev/contract/operation.ts";', "Operation.query"),
	},
	"a contract that imports operation.ts dynamically": {
		"src/client.ts": PAGE_IMPORTING_BILLING,
		"src/modules/billing/contract.ts": `import { Schema } from "effect";

export async function billingList() {
	const { query } = await import("@shivaedev/contract/operation.ts");
	return query("list", { reads: () => [], success: Schema.Array(Schema.String) });
}

export const Billing = { list: billingList };
`,
	},
	"a contract that imports query from operation.ts": {
		"src/client.ts": PAGE_IMPORTING_BILLING,
		"src/modules/billing/contract.ts": billingContractTaking('import { query } from "@shivaedev/contract/operation.ts";', "query"),
	},
	"a contract that takes query from a file re-exporting all of operation.ts": {
		"src/client.ts": PAGE_IMPORTING_BILLING,
		"src/modules/billing/contract.ts": billingContractTaking('import { query } from "#modules/billing/operations.ts";', "query"),
		"src/modules/billing/operations.ts": `export * from "@shivaedev/contract/operation.ts";
`,
	},
	"a contract that takes query from a file re-exporting it from operation.ts": {
		"src/client.ts": PAGE_IMPORTING_BILLING,
		"src/modules/billing/contract.ts": billingContractTaking('import { query } from "#modules/billing/operations.ts";', "query"),
		"src/modules/billing/operations.ts": `export { query } from "@shivaedev/contract/operation.ts";
`,
	},
	"Platform's deployUpdate": {
		"src/client.ts": `import { deployUpdate } from "@shivaedev/react/client/deployUpdate.ts";

console.log(deployUpdate);
`,
	},
} satisfies Record<string, Readonly<Record<string, string>>>;
