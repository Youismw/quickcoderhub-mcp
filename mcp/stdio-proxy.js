'use strict';

const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');

const DEFAULT_API_URL = 'https://api.quickcoderhub.com';

function getApiBaseUrl() {
  return (process.env.QUICKCODERHUB_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

async function callRemoteMcp(msg, category = null) {
  const apiBase = getApiBaseUrl();
  const mcpEndpoint = category ? `${apiBase}/mcp/${category}` : `${apiBase}/mcp`;
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `quickcoderhub-cli/${pkg.version}`
  };
  if (process.env.X402_PAYMENT_SIGNATURE) {
    headers['PAYMENT-SIGNATURE'] = process.env.X402_PAYMENT_SIGNATURE;
  }

  // Hydrate local filePath/inputPath into base64Data before sending to remote MCP server
  let outboundMsg = msg;
  if (msg && msg.method === 'tools/call' && msg.params && msg.params.arguments) {
    const args = { ...msg.params.arguments };
    const srcPath = args.filePath || args.inputPath;
    if (srcPath && !args.base64Data && !args.hexData && args.text === undefined) {
      const absPath = path.resolve(String(srcPath));
      if (!fs.existsSync(absPath)) {
        return {
          jsonrpc: '2.0',
          id: msg.id ?? null,
          error: { code: -32602, message: `Local input file not found: ${absPath}` }
        };
      }
      args.base64Data = fs.readFileSync(absPath).toString('base64');
      delete args.filePath;
      delete args.inputPath;
    }
    outboundMsg = {
      ...msg,
      params: { ...msg.params, arguments: args }
    };
  }

  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(outboundMsg)
  });

  if (res.status === 402) {
    const bodyText = await res.text();
    const paymentReq = res.headers.get('payment-required') || '';
    return {
      jsonrpc: '2.0',
      id: msg.id ?? null,
      result: {
        isError: true,
        content: [{
          type: 'text',
          text: `402 Payment Required from ${mcpEndpoint}.${paymentReq ? ` PAYMENT-REQUIRED: ${paymentReq}` : ''} Details: ${bodyText}`
        }]
      }
    };
  }

  const data = await res.json();

  // If caller asked for outputPath and remote returned outputBase64 or outputText, write locally
  const requestedOut = msg?.params?.arguments?.outputPath;
  if (requestedOut && data?.result?.content?.[0]?.text && !data.result.isError) {
    try {
      const parsed = JSON.parse(data.result.content[0].text);
      const absOut = path.resolve(String(requestedOut));
      if (parsed.outputBase64) {
        fs.writeFileSync(absOut, Buffer.from(parsed.outputBase64, 'base64'));
        delete parsed.outputBase64;
        parsed.outputPath = absOut;
        data.result.content[0].text = JSON.stringify(parsed, null, 2);
      } else if (typeof parsed.outputText === 'string') {
        fs.writeFileSync(absOut, parsed.outputText, 'utf8');
        parsed.outputPath = absOut;
        data.result.content[0].text = JSON.stringify(parsed, null, 2);
      }
    } catch {
      // Leave response as-is if not JSON
    }
  }

  return data;
}

function writeResponse(res, framed) {
  if (!res) return;
  const payload = JSON.stringify(res);
  if (framed) {
    const byteLen = Buffer.byteLength(payload, 'utf8');
    process.stdout.write(`Content-Length: ${byteLen}\r\n\r\n${payload}`);
  } else {
    process.stdout.write(payload + '\n');
  }
}

function startStdioProxy(category = null) {
  let buffer = Buffer.alloc(0);

  async function processMessage(rawJson, framed) {
    let msg;
    try {
      msg = JSON.parse(rawJson);
    } catch {
      writeResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      }, framed);
      return;
    }

    if (msg && typeof msg.method === 'string' && msg.method.startsWith('notifications/')) {
      return;
    }

    try {
      const res = await callRemoteMcp(msg, category);
      if (msg.id !== undefined && msg.id !== null) {
        writeResponse(res, framed);
      }
    } catch (err) {
      if (msg && msg.id !== undefined && msg.id !== null) {
        writeResponse({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32603, message: `Remote MCP error: ${err.message}` }
        }, framed);
      }
    }
  }

  process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      const str = buffer.toString('utf8');
      if (/^Content-Length:/i.test(str)) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const altEnd = buffer.indexOf('\n\n');
        const sepIdx = headerEnd !== -1 ? headerEnd : altEnd;
        const sepLen = headerEnd !== -1 ? 4 : 2;
        if (sepIdx === -1) break;

        const headerStr = buffer.slice(0, sepIdx).toString('utf8');
        const match = headerStr.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.slice(sepIdx + sepLen);
          continue;
        }
        const contentLen = Number(match[1]);
        if (buffer.length < sepIdx + sepLen + contentLen) break;

        const body = buffer.slice(sepIdx + sepLen, sepIdx + sepLen + contentLen).toString('utf8');
        buffer = buffer.slice(sepIdx + sepLen + contentLen);
        processMessage(body, true);
      } else {
        const nlIdx = buffer.indexOf('\n');
        if (nlIdx === -1) break;
        const line = buffer.slice(0, nlIdx).toString('utf8').trim();
        buffer = buffer.slice(nlIdx + 1);
        if (line) processMessage(line, false);
      }
    }
  });

  process.stdin.resume();
}

module.exports = {
  getApiBaseUrl,
  callRemoteMcp,
  startStdioProxy
};
