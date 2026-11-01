#!/usr/bin/env node
// Manda arquivos ou pastas de trabalho para a Lixeira do sistema (Windows ou macOS).
// Uso: node lixeira.mjs <caminho> [<caminho> ...]
//
// Só aceita caminhos DENTRO das pastas de trabalho deste fluxo:
//   $TIKTOK_SHOP_WORKDIR            cópias dos clipes, folhas de conferência, cópia do projeto anterior
//                                   (padrão: <home>/tiktok-shop)
//   <pasta temporária>/claude       folhas de análise no scratchpad
// Qualquer outro caminho é recusado. Nada é apagado de forma definitiva: vai para a Lixeira,
// e o espaço em disco só é liberado quando o usuário esvazia a Lixeira.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOTS = [
  process.env.TIKTOK_SHOP_WORKDIR || path.join(os.homedir(), "tiktok-shop"),
  path.join(os.tmpdir(), "claude"),
];
const norm = (p) => path.resolve(p).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

export function permitido(target) {
  const full = norm(target);
  return ROOTS.some((root) => full.startsWith(norm(root) + "/"));
}

// Windows: VisualBasic.FileIO, que é a mesma rota do Explorer para a Lixeira.
const COMANDOS_WINDOWS = [
  [
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Add-Type -AssemblyName Microsoft.VisualBasic; $p = $env:LIXEIRA_ALVO; " +
        "if (Test-Path -LiteralPath $p -PathType Container) { " +
        "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin') " +
        "} else { " +
        "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin') }",
    ],
  ],
];

// macOS: o Finder, que é a Lixeira de verdade (dá para restaurar com "Colocar de volta").
// O caminho vai como argumento, nunca colado no texto do AppleScript.
// Reserva: a própria API do sistema (NSFileManager), para quando a automação do Finder
// estiver negada nas permissões de Privacidade — também manda para a Lixeira.
const COMANDOS_MAC = [
  [
    "osascript",
    [
      "-e", "on run argv",
      "-e", "set alvo to POSIX file (item 1 of argv) as alias",
      "-e", "tell application \"Finder\" to delete alvo",
      "-e", "end run",
      "--", "LIXEIRA_ALVO",
    ],
  ],
  [
    "osascript",
    [
      "-l", "JavaScript",
      "-e",
      'ObjC.import("Foundation");' +
        'var alvo = $.NSProcessInfo.processInfo.environment.objectForKey("LIXEIRA_ALVO").js;' +
        "var erro = Ref();" +
        "if (!$.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError(" +
        "$.NSURL.fileURLWithPath(alvo), null, erro)) {" +
        "throw new Error(ObjC.unwrap(erro[0].localizedDescription)); }",
    ],
  ],
];

export function enviarParaLixeira(target) {
  if (!permitido(target)) return { caminho: target, ok: false, motivo: "fora das pastas de trabalho" };
  if (!fs.existsSync(target)) return { caminho: target, ok: false, motivo: "não existe" };
  const comandos = process.platform === "darwin" ? COMANDOS_MAC : COMANDOS_WINDOWS;
  const alvo = path.resolve(target);
  let erro = "";
  for (const [programa, argumentos] of comandos) {
    try {
      execFileSync(programa, argumentos.map((a) => (a === "LIXEIRA_ALVO" ? alvo : a)), {
        env: { ...process.env, LIXEIRA_ALVO: alvo },
        stdio: ["ignore", "ignore", "pipe"],
      });
      erro = "";
      break;
    } catch (error) {
      erro = String(error.stderr || error.message).trim().slice(0, 200);
    }
  }
  if (erro) return { caminho: target, ok: false, motivo: erro };
  return { caminho: target, ok: !fs.existsSync(target), motivo: fs.existsSync(target) ? "continua no lugar" : "" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error("Uso: node lixeira.mjs <caminho> [<caminho> ...]");
    process.exit(1);
  }
  const results = targets.map(enviarParaLixeira);
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.every((result) => result.ok || result.motivo === "não existe") ? 0 : 1);
}
