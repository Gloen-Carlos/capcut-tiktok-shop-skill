#!/usr/bin/env node
// Manda arquivos ou pastas de trabalho para a Lixeira do sistema.
// Uso: node lixeira.mjs <caminho> [<caminho> ...]
//
// SO: Windows e macOS.
//   Windows  PowerShell + Microsoft.VisualBasic.FileIO.FileSystem (Lixeira do Windows).
//   macOS    osascript pedindo ao Finder para mover para o Lixo. Vai para o Lixo de verdade e
//            dá para restaurar. A CLI "trash" não vem instalada, por isso o Finder.
//            Na primeira vez o macOS pede permissão para controlar o Finder; sem ela o
//            osascript falha (erro -1743) e o script devolve ok: false, sem apagar nada.
// Em outro sistema o script recusa, em vez de apagar de um jeito definitivo.
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

const WINDOWS = process.platform === "win32";
const MAC = process.platform === "darwin";

// Normalização dos caminhos para a comparação com as pastas de trabalho.
// No Windows: barras para frente e minúsculas, porque o sistema não diferencia maiúsculas e
// a barra invertida é separador. Fora dele a comparação é literal: no macOS a barra invertida
// é um caractere válido em nome de arquivo e "/Users/x/trabalho\coisa" não está dentro de
// "/Users/x/trabalho" — trocar a barra faria um caminho de fora parecer de dentro.
const norm = (p) => {
  const full = path.resolve(p);
  if (WINDOWS) return full.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return full.replace(/\/+$/, "");
};

// Uma raiz que seja a raiz do sistema de arquivos ("/" ou "C:\") liberaria o disco inteiro, por
// erro de digitação em $TIKTOK_SHOP_WORKDIR, por exemplo; nesse caso ela é descartada.
const ROOTS = [
  process.env.TIKTOK_SHOP_WORKDIR || path.join(os.homedir(), "tiktok-shop"),
  path.join(os.tmpdir(), "claude"),
].filter((root) => {
  const full = norm(root);
  return full && full !== norm(path.parse(path.resolve(root)).root);
});

export function permitido(target) {
  const full = norm(target);
  return ROOTS.some((root) => full.startsWith(norm(root) + "/"));
}

// O alvo vai pelo ambiente, não embutido no script, para o caminho não virar código.
const COMANDO = {
  windows: [
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
  // "delete" do Finder = mover para o Lixo (não é apagar). Vale para arquivo e para pasta.
  mac: [
    "osascript",
    [
      "-e",
      'set alvo to POSIX file (system attribute "LIXEIRA_ALVO")',
      "-e",
      'tell application "Finder" to delete (alvo as alias)',
    ],
  ],
};

export function enviarParaLixeira(target) {
  if (!permitido(target)) return { caminho: target, ok: false, motivo: "fora das pastas de trabalho" };
  if (!fs.existsSync(target)) return { caminho: target, ok: false, motivo: "não existe" };
  const comando = WINDOWS ? COMANDO.windows : MAC ? COMANDO.mac : null;
  if (!comando) {
    return {
      caminho: target,
      ok: false,
      motivo: "sistema " + process.platform + " sem Lixeira conhecida; apague à mão",
    };
  }
  try {
    execFileSync(comando[0], comando[1], {
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
