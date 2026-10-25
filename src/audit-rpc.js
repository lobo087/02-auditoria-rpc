const fs = require("node:fs");
const path = require("node:path");

// Cada sonda indica la criticidad de un método si el servidor lo expone.
const PROBES = [
  { method: "web3_clientVersion", params: [], risk: "informativo" },
  { method: "eth_blockNumber", params: [], risk: "bajo" },
  { method: "admin_peers", params: [], risk: "alto" },
  {
    method: "personal_unlockAccount",
    params: ["0x0000000000000000000000000000000000000000", "demo", 30],
    risk: "crítico"
  }
];

async function callRpc({ endpoint, apiKey, origin, probe, id }) {
  // Reproduce las cabeceras que enviaría una aplicación cliente.
  const headers = {
    "Content-Type": "application/json",
    Origin: origin
  };

  if (apiKey) headers["X-API-Key"] = apiKey;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: probe.method,
      params: probe.params
    })
  });

  const body = await response.json();
  const exposed = response.ok && Object.hasOwn(body, "result");

  return {
    method: probe.method,
    risk: probe.risk,
    httpStatus: response.status,
    state: exposed ? "EXPUESTO" : "BLOQUEADO",
    response: body
  };
}

/** Ejecuta todas las sondas y opcionalmente guarda el informe como JSON. */
async function auditRpc(options = {}) {
  const endpoint = options.endpoint || "http://127.0.0.1:8545";
  const apiKey = options.apiKey || "";
  const origin = options.origin || "https://origen-no-autorizado.example";
  const findings = [];

  // Se ejecutan secuencialmente para que las evidencias conserven un orden claro.
  for (let index = 0; index < PROBES.length; index += 1) {
    findings.push(await callRpc({
      endpoint,
      apiKey,
      origin,
      probe: PROBES[index],
      id: index + 1
    }));
  }

  const dangerous = findings.filter(
    (item) => ["alto", "crítico"].includes(item.risk) && item.state === "EXPUESTO"
  );

  const report = {
    generatedAt: new Date().toISOString(),
    endpoint,
    origin,
    verdict: dangerous.length ? "NO_CONFORME" : "CONFORME",
    findings
  };

  if (options.reportFile) {
    fs.mkdirSync(path.dirname(options.reportFile), { recursive: true });
    fs.writeFileSync(options.reportFile, `${JSON.stringify(report, null, 2)}\n`);
  }

  return report;
}

async function runFromEnvironment() {
  const report = await auditRpc({
    endpoint: process.env.RPC_ENDPOINT || "http://127.0.0.1:8545",
    apiKey: process.env.RPC_API_KEY || "",
    origin: process.env.AUDIT_ORIGIN || "https://origen-no-autorizado.example",
    reportFile: process.env.REPORT_FILE || "reports/rpc-audit-report.json"
  });

  console.table(report.findings.map(({ method, risk, httpStatus, state }) => ({
    method,
    risk,
    httpStatus,
    state
  })));
  console.log(`Resultado: ${report.verdict}`);

  // El código 2 diferencia un hallazgo de seguridad de un error de ejecución.
  if (report.verdict === "NO_CONFORME") process.exitCode = 2;
}

if (require.main === module) {
  runFromEnvironment().catch((error) => {
    console.error("No fue posible completar la auditoría:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { auditRpc, callRpc, PROBES };
