export type TestFinding = {
  severity: "medium" | "high";
  category: "test-failure";
  summary: string;
  details: string;
};

const FAILURE_MARKERS = ["FAIL ", "✕ ", "× "];

export function parseTestFailures(output: string): TestFinding[] {
  const lines = output.split("\n");

  return lines
    .map((line) => line.trim())
    .filter((line) => FAILURE_MARKERS.some((marker) => line.startsWith(marker)))
    .map((line) => ({
      severity: "high" as const,
      category: "test-failure" as const,
      summary: "Automated test failure",
      details: line,
    }));
}
const sampleOutput = `
> repo@1.0.0 test
> vitest run
 
  ✓ src/sum.test.ts (3)
  ✕ src/auth.test.ts > login rejects empty password
  ✕ src/auth.test.ts > login rejects short password
 
  Test Files  1 failed | 1 passed
  Tests       2 failed | 3 passed
  FAIL  src/auth.test.ts
`;

console.log(parseTestFailures(sampleOutput));
