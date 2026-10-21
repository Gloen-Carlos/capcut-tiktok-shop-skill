#!/usr/bin/env node
// Manda arquivos ou pastas de trabalho para a Lixeira do Windows.
// Uso: node lixeira.mjs <caminho> [<caminho> ...]
//
// SO: só Windows. Usa o PowerShell e o Microsoft.VisualBasic.FileIO.FileSystem. Em macOS
// seria osascript pedindo ao Finder para mover para o Lixo, ou a CLI "trash"; por ora falha.
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

export function enviarParaLixeira(target) {
  if (!permitido(target)) return { caminho: target, ok: false, motivo: "fora das pastas de trabalho" };
  if (!fs.existsSync(target)) return { caminho: target, ok: false, motivo: "não existe" };
  const script =
    "Add-Type -AssemblyName Microsoft.VisualBasic; $p = $env:LIXEIRA_ALVO; " +
    "if (Test-Path -LiteralPath $p -PathType Container) { " +
    "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin') " +
    "} else { " +
    "[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin') }";
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, LIXEIRA_ALVO: path.resolve(target) },
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    return { caminho: target, ok: false, motivo: String(error.stderr || error.message).trim().slice(0, 200) };
  }
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
