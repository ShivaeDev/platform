### Changed

- The workspace has five views: Today, Goals, Now, Library and System. Retired destinations redirect to their current view; System lists running and waiting Fleet items by title, stage and PR beside provider limits.
- Browser pages use Tailwind and shared React primitives and require JavaScript.

### Breaking

- Removed the browser-local comparison API: `workContract.queries.history`, `workContract.queries.overview`, `HistoryInput`, `HistoryOutput`, `OverviewProjection` and the `history/` entry points. The `page/board.ts` and `page/document.ts` server HTML entry points are removed.
- `page/shell.ts` now exports `shell(title, workspace)` for the React bootstrap only. Removed the superseded server rendering and style exports listed below:

  - `history/schema.ts`: `Baseline`, `HistoryInput`, `HistoryComparison`, `HistoryOutput`.
  - `server/attention/inboxHtml.ts`: `inboxHtml`, `inboxStyle`.
  - `server/attention/overviewHtml.ts`: `overviewHtml`.
  - `server/attention/style.ts`: `attentionStyle`.
  - `server/diagnostics/style.ts`: `diagnosticsStyle`.
  - `server/document/answerCardsHtml.ts`: `answerCardsHtml`.
  - `server/history/baseline.ts`: `readBaseline`, `observeBaseline`.
  - `server/history/compare.ts`: `SourceChange`, `compareHistory`.
  - `server/history/documents.ts`: `HistoryDocument`, `historyDocuments`, `historyIdentities`.
  - `server/history/fields.ts`: `historyFields`.
  - `server/history/html.ts`: `historyHtml`.
  - `server/history/limits.ts`: `MAX_BYTES`, `MAX_AGE`.
  - `server/history/response.ts`: `historyResponse`.
  - `server/http/inbox.ts`: `inbox`.
  - `server/http/overview.ts`: `overview`.
  - `server/http/work.ts`: `work`.
  - `server/page/attentionDetails.ts`: `attentionDetails`.
  - `server/page/backlinksHtml.ts`: `backlinksHtml`.
  - `server/page/boardHtml.ts`: `boardHtml`.
  - `server/page/criteriaEvidence.ts`: `criteriaEvidence`.
  - `server/page/documentHtml.ts`: `documentHtml`.
  - `server/page/itemIntroduction.ts`: `itemIntroduction`.
  - `server/page/itemStyles.ts`: `itemStyles`.
  - `server/page/metadata.ts`: `metadataHtml`, `metadataStyles`.
  - `server/page/metadataDetails.ts`: `metadataDetails`.
  - `server/page/metadataLinks.ts`: `referenceHtml`, `sourceHtml`, `documentReference`, `valueHtml`.
  - `server/page/nav.ts`: `navHtml`, `inboxCount`.
  - `server/page/readingStyles.ts`: `readingStyles`.
  - `server/page/readingTools.ts`: `readingTools`.
  - `server/page/recordedEvidence.ts`: `recordedEvidence`.
  - `server/page/searchDialog.ts`: `searchDialog`, `searchStyles`.
  - `server/page/style.ts`: `style`.
  - `server/page/updated.ts`: `updated`.
  - `server/page/visualDialog.ts`: `visualDialog`, `visualStyles`.
  - `server/page/workspaceStyles.ts`: `layout`, `theme`.
  - `server/responses/authoredQuestionHtml.ts`: `authoredQuestionHtml`.
  - `server/responses/composerHtml.ts`: `composerHtml`.
  - `server/responses/optionControls.ts`: `optionControls`.
  - `server/responses/templateHtml.ts`: `templateHtml`.
  - `server/views/tools.ts`: `viewTools`.
  - `server/views/workCards.ts`: `workCards`.
  - `server/views/workControls.ts`: `workControls`.
  - `server/views/workDetail.ts`: `workDetail`.
  - `server/views/workHtml.ts`: `workHtml`.
  - `server/views/workListStyle.ts`: `workListStyle`.
  - `server/views/workStyle.ts`: `workStyle`.
  - `server/views/workTable.ts`: `workTable`.
  - `browser/navigation/html.ts`: `navigationHtml`.
  - `server/responses/historyHtml.ts`: `historyHtml`.
