const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { auditRpc } = require("../src/audit-rpc.js");
const { ejecutarEscenario } = require("../src/laboratorio.js");
const { createRpcServer } = require("../src/mock-rpc.js");

async function withServer(options, action) {
  const server = createRpcServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try {
    return await action(endpoint);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("el modo inseguro expone métodos sensibles y queda NO_CONFORME", async () => {
  const report = await ejecutarEscenario({ mode: "insecure" });

  assert.equal(report.verdict, "NO_CONFORME");
  assert.equal(
    report.findings.find((item) => item.method === "personal_unlockAccount").state,
    "EXPUESTO"
  );
});

test("el modo seguro permite consultas y bloquea métodos sensibles", async () => {
  const report = await ejecutarEscenario({ mode: "secure" });

  assert.equal(report.verdict, "CONFORME");
  assert.equal(
    report.findings.find((item) => item.method === "eth_blockNumber").state,
    "EXPUESTO"
  );
  assert.equal(
    report.findings.find((item) => item.method === "admin_peers").state,
    "BLOQUEADO"
  );
});

test("el modo seguro rechaza una credencial incorrecta", async () => {
  await withServer(
    { mode: "secure", apiKey: "clave-correcta" },
    async (endpoint) => {
      const report = await auditRpc({
        endpoint,
        apiKey: "clave-incorrecta",
        origin: "http://localhost:3000"
      });

      assert.ok(report.findings.every((item) => item.httpStatus === 401));
    }
  );
});

test("el modo seguro limita la tasa de solicitudes", async () => {
  await withServer(
    { mode: "secure", apiKey: "clave", rateLimit: 2 },
    async (endpoint) => {
      const request = () => fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          "X-API-Key": "clave"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: []
        })
      });

      assert.equal((await request()).status, 200);
      assert.equal((await request()).status, 200);
      assert.equal((await request()).status, 429);
    }
  );
});
