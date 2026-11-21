#!/usr/bin/env node
// Manda arquivos ou pastas de trabalho para a Lixeira do sistema (Windows ou macOS).
// Uso: node lixeira.mjs <caminho> [<caminho> ...]
//
//   Windows  PowerShell + Microsoft.VisualBasic.FileIO.FileSystem (a rota do Explorer).
//   macOS    Finder pelo osascript; se a automação do Finder estiver negada nas permissões
//            de Privacidade, cai no NSFileManager, que também manda para a Lixeira.
// Em outro sistema o script recusa, em vez de apagar de um jeito definitivo.
//
// Só aceita caminhos DENTRO das pastas de trabalho deste fluxo:
//   $TIKTOK_SHOP_WORKDIR            cópias dos clipes, folhas de conferência, cópia do projeto anterior
//                                   (padrão: <home>/tiktok-shop)
//   <pasta temporária>/claude...    folhas de análise no scratchpad
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

const WORKDIR = process.env.TIKTOK_SHOP_WORKDIR || path.join(os.homedir(), "tiktok-shop");
// Scratchpad do Claude: <pasta temporária>/claude/... no Windows; no macOS pode ser
// <pasta temporária>/claude.../ ou /tmp/claude-<uid>/..., e o /tmp de lá é um atalho para
// /private/tmp, que o path.resolve não desfaz — por isso as três bases.
const TEMPS = WINDOWS ? [os.tmpdir()] : [os.tmpdir(), "/tmp", "/private/tmp"];
const PASTA_CLAUDE = WINDOWS ? /^\/claude\/./ : /^\/claude[^/]*\/./;

// Uma raiz que seja a raiz do sistema de arquivos ("/" ou "C:\") liberaria o disco inteiro, por
// erro de digitação em $TIKTOK_SHOP_WORKDIR, por exemplo; nesse caso ela não vale como raiz.
const raizValida = (root) => {
  const full = norm(root);
  return Boolean(full) && full !== norm(path.parse(path.resolve(root)).root);
};

export function permitido(target) {
  const full = norm(target);
  if (raizValida(WORKDIR) && full.startsWith(norm(WORKDIR) + "/")) return true;
  return TEMPS.some((temp) => {
    const base = norm(temp);
    return raizValida(temp) && full.startsWith(base + "/") && PASTA_CLAUDE.test(full.slice(base.length));
  });
}

// Windows: VisualBasic.FileIO, que é a mesma rota do Explorer para a Lixeira.
// O alvo vai pelo ambiente ou como argumento, nunca colado no texto do script.
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
  const comandos = WINDOWS ? COMANDOS_WINDOWS : MAC ? COMANDOS_MAC : null;
  if (!comandos) {
    return {
      caminho: target,
      ok: false,
      motivo: "sistema " + process.platform + " sem Lixeira conhecida; apague à mão",
    };
  }
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
