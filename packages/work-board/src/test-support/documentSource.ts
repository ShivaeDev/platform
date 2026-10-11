import { questionnaireSource } from "./questionnaire.ts";

export const documentSource = `${questionnaireSource}
## Evidence

| Check | State |
| --- | --- |
| Reader | Recorded |

- [x] Shipped
- [ ] Pending

A recorded claim.[^source]

[^source]: Read the [source](../checks.md).

> [!NOTE]
> Recorded claims keep their sources.

:::progress{completed="3" total="8"}
Browser checks recorded

Source: [Reading checks](../checks.md)
:::

:::metric{value="0" unit="documents"}
Documents measured

Source: [Reading checks](../checks.md)
:::

:::timeline
Reading delivery

1. **Later · planned:** [Review](../checks.md) with a reader.
2. **Earlier · recorded:** [Native reads](../checks.md) shipped.
:::

<details>
<summary>Steps</summary>

1. Open the source.

</details>

![Evidence](../shots/review.png)

\`\`\`ts
const answer = 42
\`\`\`
`;
