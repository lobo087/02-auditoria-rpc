const crypto = require("node:crypto");
const http = require("node:http");

// Métodos de lectura permitidos para una aplicación cliente del laboratorio.
const PUBLIC_METHODS = new Set(["web3_clientVersion", "eth_blockNumber"]);

// Métodos sensibles que se exponen intencionalmente solo en el modo inseguro.
const SENSITIVE_METHODS = new Set(["admin_peers", "personal_unlockAccount"]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function safeEqual(receivedValue, expectedValue) {
  // La comparación en tiempo constante evita revelar progresivamente la clave.
  const received = Buffer.from(receivedValue || "");
  const expected = Buffer.from(expectedValue || "");

  return received.length === expected.length
    && crypto.timingSafeEqual(received, expected);
}

function executeMockMethod(method) {
  // Las respuestas son ficticias: el servidor nunca firma ni mueve activos.
  if (method === "web3_clientVersion") return "CustodiaAndina-MockChain/v1.0.0";
  if (method === "eth_blockNumber") return "0x10d4f";
  if (method === "admin_peers") {
    return [{ id: "peer-demo", network: { remoteAddress: "192.0.2.10:30303" } }];
  }
  if (method === "personal_unlockAccount") return true;
  return undefined;
}

/**
 * Construye un servidor aislado que representa dos configuraciones:
 * - insecure: expone métodos administrativos sin controles;
 * - secure: autentica, filtra origen, limita tasa y aplica allowlist de métodos.
 */
function createRpcServer(options = {}) {
  const mode = options.mode === "secure" ? "secure" : "insecure";
  const apiKey = options.apiKey || "";
  const allowedOrigin = options.allowedOrigin || "http://localhost:3000";
  const rateLimit = options.rateLimit || 10;
  const rateWindowMs = options.rateWindowMs || 60_000;
  const requestsByAddress = new Map();

  if (mode === "secure" && !apiKey) {
    throw new Error("El modo seguro requiere una RPC_API_KEY");
  }

  function rateLimitExceeded(address) {
    const now = Date.now();
    const current = requestsByAddress.get(address);

    if (!current || now - current.startedAt >= rateWindowMs) {
      requestsByAddress.set(address, { startedAt: now, count: 1 });
      return false;
    }

    current.count += 1;
    return current.count > rateLimit;
  }

  return http.createServer((request, response) => {
    // JSON-RPC por HTTP se recibe únicamente mediante POST.
    if (request.method !== "POST") {
      return sendJson(response, 405, { error: "Método HTTP no permitido" });
    }

    const address = request.socket.remoteAddress || "unknown";

    if (mode === "secure") {
      // Aplica los controles antes de procesar el cuerpo de la solicitud.
      if (rateLimitExceeded(address)) {
        return sendJson(response, 429, { error: "Límite de solicitudes excedido" });
      }

      const origin = request.headers.origin;
      if (origin && origin !== allowedOrigin) {
        return sendJson(response, 403, { error: "Origen no autorizado" });
      }

      if (!safeEqual(request.headers["x-api-key"], apiKey)) {
        return sendJson(response, 401, { error: "Credencial ausente o inválida" });
      }
    }

    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;

      // Limita el tamaño para reducir el riesgo de agotamiento de memoria.
      if (rawBody.length > 16_384) {
        sendJson(response, 413, { error: "Solicitud demasiado grande" });
        request.destroy();
      }
    });

    request.on("end", () => {
      if (response.writableEnded) return;

      let rpcRequest;
      try {
        rpcRequest = JSON.parse(rawBody);
      } catch {
        return sendJson(response, 400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "JSON inválido" }
        });
      }

      const { id = null, method } = rpcRequest;

      // El modo seguro implementa una lista explícita de métodos permitidos.
      if (mode === "secure" && !PUBLIC_METHODS.has(method)) {
        return sendJson(response, 403, {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Método no autorizado" }
        });
      }

      if (!PUBLIC_METHODS.has(method) && !SENSITIVE_METHODS.has(method)) {
        return sendJson(response, 404, {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Método inexistente" }
        });
      }

      return sendJson(response, 200, {
        jsonrpc: "2.0",
        id,
        result: executeMockMethod(method)
      });
    });
  });
}

async function startFromEnvironment() {
  const host = process.env.RPC_HOST || "127.0.0.1";
  const port = Number(process.env.RPC_PORT || 8545);
  const mode = process.env.RPC_MODE === "secure" ? "secure" : "insecure";

  const server = createRpcServer({
    mode,
    apiKey: process.env.RPC_API_KEY || "",
    allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:3000"
  });

  server.listen(port, host, () => {
    console.log(`RPC simulado en http://${host}:${port} | modo=${mode}`);
  });
}

if (require.main === module) {
  startFromEnvironment().catch((error) => {
    console.error("No fue posible iniciar el servidor:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { createRpcServer, PUBLIC_METHODS, SENSITIVE_METHODS };
