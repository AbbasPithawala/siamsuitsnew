export interface EtlSkip {
  legacyId: string;
  reason: string;
}

export interface EtlDomainResult {
  domain: string;
  found: number;
  migrated: number;
  skipped: EtlSkip[];
}

export function summarizeDomain(result: EtlDomainResult): string {
  const lines = [`${result.domain}: found ${result.found}, migrated ${result.migrated}, skipped ${result.skipped.length}`];
  for (const skip of result.skipped) {
    lines.push(`  - skipped ${skip.legacyId}: ${skip.reason}`);
  }
  return lines.join("\n");
}
