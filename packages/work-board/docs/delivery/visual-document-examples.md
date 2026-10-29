# Visual document conventions

Work Board parses these directives with `remark-directive` and renders their body through its Markdown/GFM pipeline. These are Markdown extensions, not built-in CommonMark elements. Other readers can show literal directive markers and readable Markdown contents. No migration of ordinary Markdown or frontmatter is required.

## Fixed component vocabulary

Use `:::metric`, `:::progress` or `:::timeline` containers. Start each with a nonblank Markdown label paragraph that does not begin with `Source:`. Body text, links and emphasis remain Markdown. Attribute values are strings decoded with Effect Schema; an unknown attribute rejects the component. Values are recorded source claims, never verified acceptance.

### Metric

```markdown
:::metric{value="50" unit="documents"}
Representative fixture target

Source: [Reading checks](checks.md)
:::

:::metric{value="unknown" unit="seconds"}
Representative-reader orientation

Source: [Reader acceptance](reader-review.md)
:::
```

`unit` is required and nonblank. `value` is a finite number, `unknown`, or omitted. A number renders as a `<value> <unit>` line below the label; an unknown or omitted value adds no value line. A paragraph beginning `Source:` with a Markdown link is required. Source links identify provenance; their existence or statements are not verified by the component.

### Progress

```markdown
:::progress{completed="3" total="8"}
Example reading checks recorded

This tally records checks, not verified acceptance.

Source: [Reading checks](checks.md)
:::
```

`completed` and `total` are nonnegative safe integers, `unknown`, or omitted. Known counts require `completed <= total`. When both counts are known, the component shows `Recorded tally: <completed> of <total>`, and a positive total adds a native, labeled progress bar. A missing or unknown count shows no tally, and 0/0 shows the tally without a bar. Counts are never inferred from statuses, owners, task lists or criterion evidence. A `Source:` linked paragraph is required. A zero completed count is a recorded zero, not missing information.

### Timeline

```markdown
:::timeline
Reading delivery
1. **First:** inspect [source conventions](source-examples.md).
2. **Then:** review [response context](response-write-examples.md).
   :::
```

Use one ordered list containing 1–100 entries. Each entry needs text and a source link. Keep author order and literal labels, including planned/recorded qualifiers; do not parse dates, infer deadlines, schedule work or derive agent state. Timeline attributes are not supported. Ordinary Markdown emphasis and links remain intact. Mermaid handles diagrams, including its own timeline diagram syntax.

## Callouts and comparisons

Use GitHub's five alert markers: NOTE, TIP, IMPORTANT, WARNING and CAUTION. Unknown markers stay ordinary blockquotes. Comparisons stay GFM tables; colors, columns and ordering never select an option or assert an approval.

```markdown
> [!IMPORTANT]
> A recorded browser result does not establish representative-reader acceptance.

| Option            | Benefit                | Cost                     | Source                                   |
| ----------------- | ---------------------- | ------------------------ | ---------------------------------------- |
| Ordinary Markdown | Familiar everywhere    | Fewer visual affordances | [Source conventions](source-examples.md) |
| Fixed directives  | Explicit visual intent | An extension to document | [Delivery plan](plan.md)                 |
```

## Fallback and ownership

- Unknown/invalid containers, unknown attributes, missing labels/sources, invalid ratios and nonfinite values retain the complete original source as code with a local diagnostic. Later components and ordinary prose stay readable.
- Inline/leaf visual forms are unsupported. Inline directives retain their literal source; unsupported leaf forms show source and a diagnostic. Unclosed or malformed syntax follows `remark-directive`'s parsing rules.
- A component is limited to 64 KiB of source. Nested visual directives are unsupported; original source remains visible.
- Render fixed semantic elements. No author-supplied JavaScript, JSX, executable MDX, templates, queries, plugin loading or remote data fetching.
- Preserve headings, local links, search/backlinks, print text alternatives, native update ownership. No source writes, new frontmatter fields, YAML visual fences or acceptance inference.
