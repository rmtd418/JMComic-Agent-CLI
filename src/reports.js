import fs from "node:fs";
import path from "node:path";
import { sanitizeName } from "./shared/paths.js";

export function writeSearchReports({ artifacts, command, result }) {
  if (!artifacts?.reports_dir) return {};
  fs.mkdirSync(artifacts.reports_dir, { recursive: true });
  const base = sanitizeName(`${command}-${result.query || "search"}`, "report");
  const jsonPath = path.join(artifacts.reports_dir, `${base}.json`);
  const mdPath = path.join(artifacts.reports_dir, `${base}.md`);
  const report = {
    query: result.query,
    provider: result.provider,
    search_total: result.search_total,
    filtered_count: result.filtered_count,
    returned_count: result.returned_count,
    output_mode: result.output_mode,
    shortlist: result.shortlist,
    selection_policy: result.selection_policy,
    applied_filters: result.applied_filters,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  const lines = [
    `# ${command} report`,
    "",
    `- provider: ${result.provider}`,
    `- query: ${result.query}`,
    `- search_total: ${result.search_total}`,
    `- filtered_count: ${result.filtered_count}`,
    "",
    "## Shortlist",
    "",
    ...result.shortlist.map((item, index) => `${index + 1}. ${item.id} ${item.title}`),
    "",
  ];
  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  artifacts.report_targets = { json: jsonPath, markdown: mdPath };
  return artifacts.report_targets;
}
