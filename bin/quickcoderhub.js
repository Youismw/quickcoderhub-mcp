#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getApiBaseUrl, callRemoteMcp, startStdioProxy } = require('../mcp/stdio-proxy.js');
const pkg = require('../package.json');

const CATEGORY_SLUGS = [
  '3d-cad',
  'embedded-eda',
  'binary-forensics',
  'pdf-suite',
  'devops-linux',
  'security-crypto',
  'net-web-media',
  'data-api-code',
  'all'
];

const TOOL_SLUGS = [
  // Flagship & Category 1: 3D CAD (6)
  'stl-heal', '3d-format-converter', 'stl-slicer', 'gcode-estimator', 'svg-optimizer', 'svg-path-inspector',
  // Category 2: Embedded & EDA (8)
  'firmware-merger', 'serial-crash-decoder', 'karnaugh-verilog-studio', 'logic-trace-decoder',
  'intel-hex-inspector', 'can-bus-decoder', 'cmake-generator', 'ieee754',
  // Category 3: Binary & Forensics (12)
  'binary-triage', 'executable-inspector', 'wasm-disassembler', 'wasm-inspector', 'hexdump-viewer', 'archive-joiner',
  'archive-peeker', 'pcap-viewer', 'exif-viewer', 'sqlite-explorer', 'sourcemap-explorer', 'unicode-inspector',
  // Category 4: PDF Suite (20)
  'pdf-repair', 'pdf-compliance-audit', 'merge-pdf', 'split-pdf', 'remove-pdf-pages', 'extract-pdf-pages',
  'rotate-pdf', 'add-page-numbers', 'add-watermark', 'crop-pdf', 'protect-pdf', 'unlock-pdf', 'redact-pdf',
  'pdf-forms', 'pdf-to-markdown', 'pdf-to-pdfa', 'compare-pdf', 'compress-pdf', 'jpg-to-pdf', 'html-to-pdf',
  // Category 5: DevOps & Linux (20)
  'docker-to-systemd', 'systemd-analyzer', 'seccomp-apparmor-generator', 'server-log-analyzer',
  'docker-to-compose', 'dockerfile-linter', 'docker-image-inspector', 'k8s-inspector', 'k8s-resource-estimator',
  'terraform-plan-inspector', 'hcl-formatter', 'nginx-linter', 'apache-inspector', 'github-actions-visualizer',
  'github-actions-expression-tester', 'gitlab-ci-visualizer', 'dotenv-inspector', 'cron-explainer',
  'gitignore-generator', 'bash-linter',
  // Category 6: Security & Cryptography (20)
  'certificate-inspector', 'saml-decoder', 'jwt-decoder', 'pgp-studio', 'key-pair-generator',
  'ssh-config-generator', 'ssh-known-hosts-inspector', 'csp-builder', 'cors-simulator', 'permissions-policy-builder',
  'referrer-policy-builder', 'defang-url', 'sbom-viewer', 'license-analyzer', 'package-json-inspector',
  'lockfile-explorer', 'password-hasher', 'aes-encryption', 'hmac-generator', 'bip39-generator',
  // Category 7: Networking, Web & Media (18)
  'subnet-calculator', 'ipv4-converter', 'ipv4-range-expander', 'ipv6-calculator', 'mac-address-lookup',
  'webrtc-sdp-analyzer', 'websocket-inspector', 'har-analyzer', 'http-header-analyzer', 'cache-control-builder',
  'robots-txt-tester', 'sitemap-validator', 'feed-validator', 'json-ld-inspector', 'a11y-auditor',
  'subtitle-converter', 'subtitle-editor', 'av-remux-subtitles',
  // Category 8: Data, API & Code (19)
  'openapi-explorer', 'openapi-mock-generator', 'graphql-explorer', 'graphql-query-builder', 'curl-to-code',
  'sql-formatter', 'sql-to-er', 'json-to-types', 'json-schema-mock', 'jsonpath-tester', 'json-diff',
  'json-to-csv', 'csv-explorer', 'ndjson-viewer', 'yaml-to-json', 'xml-formatter', 'ast-explorer',
  'semver-tester', 'test-case-parser'
];

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function printHelp() {
  process.stdout.write(
    `quickcoderhub v${pkg.version} — Thin CLI & stdio MCP proxy for ${getApiBaseUrl()}\n\n` +
    `Usage:\n` +
    `  quickcoderhub <tool-slug> [file|-] [--out output] [--json] [--key val]\n` +
    `  quickcoderhub mcp [--category <slug>]    Start stdio MCP proxy (default: flagship 20)\n` +
    `  quickcoderhub list [--category <slug>]   Fetch tool catalog from ${getApiBaseUrl()}\n` +
    `  quickcoderhub --help | --version\n\n` +
    `MCP Categories: ${CATEGORY_SLUGS.join(', ')}\n` +
    `Supported Tools (${TOOL_SLUGS.length}): ${TOOL_SLUGS.join(', ')}\n\n` +
    `Environment:\n` +
    `  QUICKCODERHUB_API_URL     Override API base URL (default: https://api.quickcoderhub.com)\n` +
    `  X402_PAYMENT_SIGNATURE    Optional x402 PAYMENT-SIGNATURE header for paid calls\n\n` +
    `Exit codes: 0 = success, 1 = runtime/API error, 2 = invalid usage\n`
  );
}

function readStdinBytes() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

async function readInputBytes(fileArg, allowEmpty = false) {
  if (fileArg && fileArg !== '-') {
    return fs.readFileSync(path.resolve(fileArg));
  }
  if (!fileArg && process.stdin.isTTY) {
    if (allowEmpty) return Buffer.alloc(0);
    const err = new Error('No input file specified and stdin is an interactive TTY. Pass a file path or pipe bytes.');
    err.exitCode = 2;
    throw err;
  }
  return readStdinBytes();
}

function parseArgs(argv) {
  const opts = { positional: [], json: false, query: {} };
  const flagMap = {
    '--min-len': 'minLen',
    '--max-strings': 'maxStrings',
    '--format': 'outputFormat',
    '--scale': 'scale',
    '--retention': 'retentionPct',
    '--svg-depth': 'svgDepthMm',
    '--layer-height': 'layerHeight',
    '--infill': 'infillDensity',
    '--speed': 'printSpeed',
    '--pattern': 'infillPattern',
    '--offset': 'offset',
    '--family-id': 'uf2FamilyId',
    '--arch': 'arch',
    '--base-addr': 'baseAddress',
    '--protocol': 'protocol',
    '--service-name': 'serviceName',
    '--runtime': 'runtime',
    '--num-vars': 'numVars',
    '--minterms': 'minterms'
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--rootless') {
      opts.query.rootless = 'true';
    } else if (arg === '--cert') {
      opts.query.generateCertificatePdf = 'true';
    } else if (arg === '--out' || arg === '-o') {
      if (i + 1 >= argv.length) throw Object.assign(new Error(`Missing value after ${arg}`), { exitCode: 2 });
      opts.out = argv[++i];
    } else if (flagMap[arg]) {
      if (i + 1 >= argv.length) throw Object.assign(new Error(`Missing value after ${arg}`), { exitCode: 2 });
      const val = argv[++i];
      if (arg === '--format') {
        opts.query.outputFormat = val;
        if (val !== 'json') opts.query.format = val;
      } else {
        opts.query[flagMap[arg]] = val;
      }
    } else if (arg === '-' || !arg.startsWith('-')) {
      opts.positional.push(arg);
    } else {
      throw Object.assign(new Error(`Unknown flag: ${arg}`), { exitCode: 2 });
    }
  }
  return opts;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    printHelp();
    process.exit(0);
  }
  if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(pkg.version + '\n');
    process.exit(0);
  }

  const cmd = args[0];
  function parseCategoryFlag(rest) {
    const idx = rest.findIndex(a => a === '--category' || a === '-c');
    if (idx === -1) return null;
    if (idx + 1 >= rest.length) {
      process.stderr.write('Error: Missing category slug after --category.\n');
      process.exit(2);
    }
    const cat = rest[idx + 1];
    if (!CATEGORY_SLUGS.includes(cat) && cat !== 'flagship') {
      process.stderr.write(`Error: Unknown category "${cat}". Valid: ${CATEGORY_SLUGS.join(', ')}\n`);
      process.exit(2);
    }
    return cat;
  }

  if (cmd === 'mcp') {
    startStdioProxy(parseCategoryFlag(args.slice(1)));
    return;
  }

  if (cmd === 'list') {
    const cat = parseCategoryFlag(args.slice(1));
    try {
      const rpc = await callRemoteMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, cat);
      const tools = rpc?.result?.tools || [];
      process.stdout.write(JSON.stringify(tools, null, 2) + '\n');
      return;
    } catch (err) {
      process.stderr.write(`Error fetching tools from ${getApiBaseUrl()}: ${err.message}\n`);
      process.exit(1);
    }
  }

  if (!TOOL_SLUGS.includes(cmd)) {
    process.stderr.write(`Error: Unknown tool "${cmd}". Run "quickcoderhub --help".\n`);
    process.exit(2);
  }

  let opts;
  try {
    opts = parseArgs(args.slice(1));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(err.exitCode || 2);
  }

  if (opts.positional.length > 1) {
    process.stderr.write('Error: Unexpected extra positional arguments.\n');
    process.exit(2);
  }

  try {
    const allowEmpty = cmd === 'karnaugh-verilog-studio';
    const inputBytes = await readInputBytes(opts.positional[0], allowEmpty);

    const qs = new URLSearchParams(opts.query);
    if (opts.json) qs.set('responseFormat', 'json');
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    const url = `${getApiBaseUrl()}/v1/${cmd}${queryStr}`;

    const headers = {
      'Content-Type': 'application/octet-stream',
      'User-Agent': `quickcoderhub-cli/${pkg.version}`
    };
    if (process.env.X402_PAYMENT_SIGNATURE) {
      headers['PAYMENT-SIGNATURE'] = process.env.X402_PAYMENT_SIGNATURE;
    }

    const res = await fetch(url, { method: 'POST', headers, body: inputBytes });
    if (res.status === 402) {
      const bodyText = await res.text();
      process.stderr.write(`402 Payment Required from ${url}\n${bodyText}\n`);
      process.exit(1);
    }

    const contentType = res.headers.get('content-type') || '';
    const respBuf = Buffer.from(await res.arrayBuffer());

    if (!res.ok) {
      process.stderr.write(`HTTP ${res.status} from ${url}: ${respBuf.toString('utf8')}\n`);
      process.exit(1);
    }

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(respBuf.toString('utf8'));
      if (opts.out) {
        if (parsed.outputBase64) {
          fs.writeFileSync(path.resolve(opts.out), Buffer.from(parsed.outputBase64, 'base64'));
        } else if (typeof parsed.outputText === 'string') {
          fs.writeFileSync(path.resolve(opts.out), parsed.outputText, 'utf8');
        } else {
          fs.writeFileSync(path.resolve(opts.out), JSON.stringify(parsed, null, 2), 'utf8');
        }
      }
      if (opts.json || !opts.out) {
        process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
      } else {
        process.stdout.write(`Output written to ${opts.out}\n`);
      }
      return;
    }

    if (opts.out) {
      fs.writeFileSync(path.resolve(opts.out), respBuf);
      const hash = sha256Hex(respBuf);
      process.stdout.write(`Output written to ${opts.out} (${respBuf.length} bytes, sha256=${hash.slice(0, 12)})\n`);
    } else {
      process.stdout.write(respBuf);
    }
  } catch (err) {
    const code = err.exitCode || 1;
    if (opts.json) {
      process.stderr.write(JSON.stringify({ error: err.message }) + '\n');
    } else {
      process.stderr.write(`Error: ${err.message}\n`);
    }
    process.exit(code);
  }
}

main();
