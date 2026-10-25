# Laboratorio 02: auditoría de una interfaz JSON-RPC

Este laboratorio representa la infraestructura blockchain de **Custodia Andina** mediante un servidor JSON-RPC local. Se comparan dos configuraciones: una interfaz insegura que publica métodos sensibles y una interfaz endurecida que incorpora autenticación, control de origen, limitación de tasa y una lista explícita de métodos permitidos.

El ejercicio utiliza datos simulados, escucha únicamente en `127.0.0.1` y no se conecta a nodos blockchain reales.

## Objetivos

- Identificar métodos RPC administrativos o relacionados con cuentas.
- Comparar una configuración `insecure` con una configuración `secure`.
- Generar informes reproducibles con veredictos `NO_CONFORME` y `CONFORME`.
- Comprobar autenticación, filtrado de origen, allowlist y limitación de tasa.

## Requisitos

- Node.js 22 o superior. Probado con Node.js 24.
- npm 10 o superior.
- Puerto 8545 disponible únicamente si se realiza la ejecución manual.

Compruebe las versiones:

```bash
node --version
npm --version
```

## Instalación paso a paso

1. Descargue o clone el repositorio.
2. Abra una terminal en la carpeta del proyecto.
3. Instale el proyecto:

```bash
npm install
```

4. Ejecute las pruebas:

```bash
npm test
```

Las pruebas verifican exposición insegura, bloqueo de métodos, rechazo de credenciales y limitación de tasa.

## Ejecución automática recomendada

Ejecute:

```bash
npm run lab
```

El script crea servidores efímeros en puertos disponibles, ejecuta ambas auditorías y los cierra automáticamente. El resultado esperado es:

```text
Escenario 1 — configuración insegura
Veredicto: NO_CONFORME

Escenario 2 — configuración endurecida
Veredicto: CONFORME

Laboratorio completado: NO_CONFORME → CONFORME
```

Las evidencias quedan en:

- `reports/rpc-insecure.json`
- `reports/rpc-secure.json`

También puede ejecutar todo con:

```bash
npm run check
```

## Ejecución manual en Linux o macOS

Terminal 1, modo inseguro:

```bash
RPC_MODE=insecure npm run server
```

Terminal 2:

```bash
REPORT_FILE=reports/manual-insecure.json npm run audit
```

El auditor termina con código `2` porque encontró métodos sensibles expuestos. Es un resultado esperado.

Para el modo seguro, reinicie el servidor:

```bash
RPC_MODE=secure RPC_API_KEY=clave-laboratorio npm run server
```

Desde la segunda terminal:

```bash
RPC_API_KEY=clave-laboratorio AUDIT_ORIGIN=http://localhost:3000 REPORT_FILE=reports/manual-secure.json npm run audit
```

## Ejecución manual en PowerShell

Terminal 1:

```powershell
$env:RPC_MODE="secure"
$env:RPC_API_KEY="clave-laboratorio"
npm run server
```

Terminal 2:

```powershell
$env:RPC_API_KEY="clave-laboratorio"
$env:AUDIT_ORIGIN="http://localhost:3000"
$env:REPORT_FILE="reports/manual-secure.json"
npm run audit
```

## Qué hace cada fragmento

| Archivo o fragmento | Función |
| --- | --- |
| `createRpcServer()` | Construye el nodo RPC simulado sin abrir conexiones externas. |
| `PUBLIC_METHODS` | Define las consultas que una aplicación puede utilizar. |
| `SENSITIVE_METHODS` | Modela métodos que no deben publicarse. |
| `safeEqual()` | Compara la clave de API en tiempo constante. |
| `rateLimitExceeded()` | Cuenta solicitudes por dirección dentro de una ventana temporal. |
| `auditRpc()` | Ejecuta cuatro sondas y clasifica cada resultado. |
| `ejecutarEscenario()` | Abre un servidor efímero, lo audita y garantiza su cierre. |
| `run-lab.js` | Compara los modos inseguro y seguro en una sola ejecución. |

## Interpretación

En el modo inseguro, `admin_peers` y `personal_unlockAccount` responden con éxito; por eso el resultado es `NO_CONFORME`. En el modo seguro, solo se permiten `web3_clientVersion` y `eth_blockNumber`. La clave de API no reemplaza TLS, segmentación, un proxy inverso o una gestión formal de identidades; funciona únicamente como control didáctico dentro del entorno local.

## Clonar el repositorio y comenzar a trabajar

Sigue estos pasos para descargar el repositorio y trabajar localmente desde Visual Studio Code.

### 1. Requisitos previos

Verifica que tengas instalados:

- [Git](https://git-scm.com/downloads)
- [Visual Studio Code](https://code.visualstudio.com/)

### 2. Abrir PowerShell

Abre PowerShell o la terminal integrada de Visual Studio Code y dirígete a la carpeta donde guardarás el proyecto. Por ejemplo:

```powershell
cd $HOME\Documents
```

### 3. Clonar el repositorio

Ejecuta el siguiente comando:

```powershell
git clone https://github.com/lobo087/02-auditoria-rpc.git
```

Esto descargará el repositorio y creará la carpeta `02-auditoria-rpc`.

### 4. Abrir el proyecto en VS Code

Ingresa a la carpeta del proyecto:

```powershell
cd 02-auditoria-rpc
```

Abre el proyecto en Visual Studio Code:

```powershell
code .
```

### 5. Verificar el repositorio

Comprueba que Git reconoce el proyecto y que está conectado al repositorio original:

```powershell
git status
git remote -v
```

### 6. Guardar los cambios

Después de modificar los archivos, puedes registrar tus cambios localmente con los siguientes comandos:

```powershell
git add .
git commit -m "Descripción de los cambios realizados"
```

Para publicar los cambios en GitHub, necesitarás permisos de escritura en el repositorio original o trabajar desde un *fork* de tu propia cuenta.

**Nota:** Clonar el repositorio no modifica el proyecto original. Los cambios realizados localmente solo se publican en GitHub cuando se ejecuta un `git push` con los permisos correspondientes.

## Licencia

MIT. Consulte `LICENSE`.
