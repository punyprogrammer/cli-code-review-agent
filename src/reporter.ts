import { type Finding } from "./analyze";
import { type TestFinding } from "./test-runner";
export type CombinedReview = {
  overallRisk: "low" | "medium" | "high";
  aiFindings: Finding[];
  testFindings: TestFinding[];
};
const SEVERITY_RANK: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const useColor = process.env.CI !== "true";
function color(code: string, text: string): string {
  if (!useColor) return text;
  //   This is the ANSI escape code for color.
  return `\x1b[${code}m${text}\x1b[0m`;
}
function riskColor(risk: CombinedReview["overallRisk"]): string {
  if (risk === "high") return "31"; // red
  if (risk === "medium") return "33"; // yellow
  return "32"; // green
}
function severityColor(severity: Finding["severity"]): string {
  if (severity === "critical" || severity === "high") return "31";
  if (severity === "medium") return "33";
  return "90"; // gray
}
export function printReview(review: CombinedReview): void {
  const totalFindings = review.aiFindings.length + review.testFindings.length;
  const riskLabel = review.overallRisk.toUpperCase();

  console.log("");
  console.log(
    `Overall risk: ${color(riskColor(review.overallRisk), riskLabel)}`,
  );
  console.log(`Total findings: ${totalFindings}`);
  console.log("");

  if (review.aiFindings.length > 0) {
    console.log("AI findings:");
    const sorted = [...review.aiFindings].sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
    );
    for (const finding of sorted) {
      const tag = color(
        severityColor(finding.severity),
        `[${finding.severity.toUpperCase()}]`,
      );
      console.log(`  ${tag} ${finding.summary} (${finding.file})`);
      console.log(`     → ${finding.recommendation}`);
    }
    console.log("");
  }

  if (review.testFindings.length > 0) {
    console.log("Test findings:");
    for (const finding of review.testFindings) {
      const tag = color(
        severityColor(finding.severity),
        `[${finding.severity.toUpperCase()}]`,
      );
      console.log(`  ${tag} ${finding.details}`);
    }
    console.log("");
  }

  if (totalFindings === 0) {
    console.log("No findings. The repo is clean by both AI and test signals.");
    console.log("");
  }
}
