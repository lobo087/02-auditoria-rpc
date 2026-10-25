const { ejecutarEscenario } = require("../src/laboratorio.js");

function mostrar(nombre, reporte) {
  console.log(`\n${nombre}`);
  console.table(reporte.findings.map(({ method, risk, httpStatus, state }) => ({
    method,
    risk,
    httpStatus,
    state
  })));
  console.log(`Veredicto: ${reporte.verdict}`);
}

async function main() {
  // Primera ejecución: reproduce la exposición de métodos de administración y cuentas.
  const insecure = await ejecutarEscenario({
    mode: "insecure",
    reportFile: "reports/rpc-insecure.json"
  });
  mostrar("Escenario 1 — configuración insegura", insecure);

  // Segunda ejecución: activa autenticación, origen permitido, tasa y allowlist.
  const secure = await ejecutarEscenario({
    mode: "secure",
    reportFile: "reports/rpc-secure.json"
  });
  mostrar("Escenario 2 — configuración endurecida", secure);

  if (insecure.verdict !== "NO_CONFORME" || secure.verdict !== "CONFORME") {
    throw new Error("Los escenarios no produjeron los veredictos esperados");
  }

  console.log("\nLaboratorio completado: NO_CONFORME → CONFORME");
}

main().catch((error) => {
  console.error("No fue posible ejecutar el laboratorio:", error.message);
  process.exitCode = 1;
});
