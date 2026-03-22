/**
 * Smart Ingestion Parser
 * Auto-detects fields regardless of their position in a semicolon/comma separated line.
 */

export interface IngestionPart {
  domain: string;
  ip: string;
  serverHint: string;
  provider: string;
  status: string;
  raw: string;
  error?: string;
}

const REGISTRARS = ['godaddy', 'namecheap', 'dynadot', 'google', 'cloudflare', 'gandi', 'route53'];

export function parseIngestionLine(line: string): IngestionPart | null {
  const raw = line.trim();
  if (!raw) return null;

  const parts = raw.split(/[;,]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let domain = '';
  let ip = '';
  let serverHint = '';
  let provider = '';
  let status = 'inbox';

  // regex for IP
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // regex for domain (simplified, must have at least one dot)
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
  // regex for server hint (sscXXXX or just numbers if they are likely IDs)
  const serverRegex = /^ssc\d+$/i;

  parts.forEach((p, index) => {
    const pl = p.toLowerCase();

    // 1. Check if it's an IP
    if (ipRegex.test(p)) {
      if (!ip) ip = p;
      return;
    }

    // 2. Check if it's a server hint (sscXXXX)
    if (serverRegex.test(p)) {
      if (!serverHint) serverHint = p;
      return;
    }

    // 3. Check if it's a known provider
    if (REGISTRARS.includes(pl)) {
      if (!provider) provider = p; // Keep original casing or capitalize
      return;
    }

    // 4. Check if it's a status
    if (['inbox', 'spam', 'blocked'].includes(pl)) {
      status = pl;
      return;
    }

    // 5. If it looks like a domain and we don't have one yet
    if (domainRegex.test(p)) {
      if (!domain) domain = p;
      return;
    }
  });

  // Fallback if domain/ip weren't found by regex but exist in first/second positions
  if (!domain && parts[0] && !parts[0].startsWith('ssc') && !REGISTRARS.includes(parts[0].toLowerCase())) {
    domain = parts[0];
  }
  if (!ip && parts[1] && ipRegex.test(parts[1])) {
    ip = parts[1];
  }

  const error = !domain ? 'Missing domain' : undefined;

  return {
    domain,
    ip: ip || '0.0.0.0',
    serverHint,
    provider: provider || 'Godaddy',
    status,
    raw,
    error
  };
}

export function parseIngestionText(text: string): IngestionPart[] {
  return text
    .split('\n')
    .map(line => parseIngestionLine(line))
    .filter((p): p is IngestionPart => p !== null);
}
