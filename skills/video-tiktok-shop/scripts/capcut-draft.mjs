#!/usr/bin/env node
// Gera um projeto (rascunho) do CapCut a partir de um plano de cortes.
// Uso: node capcut-draft.mjs <plano.json>
//
// plano.json:
// {
//   "name": "TikTok Shop",                            nome do projeto no CapCut (padrão "TikTok Shop")
//   "template": "Meu molde",                          opcional: projeto do CapCut usado como molde;
//                                                     sem isso, usa a cópia congelada em assets/molde
//   "mediaDir": "<workdir>/Clipes/Polo",            pasta estável para onde os clipes são copiados
//   "fps": 30,                                        taxa do projeto (padrão 30)
//   "text": "Linha 1\nLinha 2",                       headline (use \n para a quebra)
//   "clips": [ { "file": "D:/.../clipe.mp4", "start": 16, "frames": 84, "rate": 1.3 }, ... ]
// }
// "start" e "frames" são frames do arquivo de origem (na taxa do próprio arquivo);
// "rate" é opcional (1 = normal). Os cortes são encaixados na grade de frames do projeto:
// um clipe em velocidade normal perde no máximo um frame no fim, nunca vaza o plano vizinho.
// Cada clipe também é conferido contra os cortes de cena do arquivo: um trecho que atravesse um
// corte é reduzido ao maior pedaço contínuo, para não entrar pedaço de outro plano (desligue num
// clipe com "permitirCortes": true; os ajustes saem em "ajustesDeCorte").
// Gera também <mediaDir>/conferencia.jpg com o primeiro e o último quadro de cada clipe.
//
// Trabalha sempre no mesmo projeto: .../CapCut/User Data/Projects/com.lveditor.draft/<name>.
// Se ele não existe, cria. Se existe e foi criado por este script, substitui o conteúdo
// (guardando UMA cópia do anterior em <pasta acima de mediaDir>/_projeto-anterior.json).
// Ao gerar uma sequência nova, manda para a Lixeira a pasta de clipes da sequência anterior.
// Não altera projetos de outra origem nem o índice do CapCut.
// O projeto precisa estar fechado no CapCut na hora de gerar.
//
// SO: Windows e macOS. O que muda entre os dois:
//   - caminho padrão da pasta do CapCut: AppData/Local no Windows, ~/Movies no macOS
//     (sempre ajustável por "capcutUserData" ou "draftsRoot" no plano);
//   - checagem de "projeto aberto no CapCut": rename do clipe em uso no Windows, lsof + processo
//     do CapCut no macOS (ver o bloco adiante);
//   - limpeza: o lixeira.mjs usa a Lixeira de cada sistema.
// Em outro sistema o script para e pede "capcutUserData"/"draftsRoot" no plano.
// O lado macOS foi escrito sem Mac para testar; ver a lista de conferência no README.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { enviarParaLixeira } from "./lixeira.mjs";

const planPath = process.argv[2];
if (!planPath) {
  console.error("Uso: node capcut-draft.mjs <plano.json>");
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const fps = plan.fps || 30;
const WINDOWS = process.platform === "win32";

// Pasta "User Data" do CapCut. O padrão do macOS (~/Movies) vem de blogs, não da documentação
// da CapCut, então quando a pasta não existe o script para e diz onde achar o caminho certo,
// em vez de sair tentando outros lugares ou criar um projeto que o CapCut nunca vai listar.
const PADRAO_USER_DATA = {
  win32: "AppData/Local/CapCut/User Data",
  darwin: "Movies/CapCut/User Data",
}[process.platform];
const comoApontar =
  'Informe no plano "capcutUserData": "<.../CapCut/User Data>" ou "draftsRoot": ' +
  '"<.../CapCut/User Data/Projects/com.lveditor.draft>".';
// Só "draftsRoot" no plano: a pasta do CapCut é a de dois níveis acima, que é como o próprio
// CapCut monta esse caminho. É ela que resolve o {{CAPCUT_USER_DATA}} do molde.
const capcutUserData =
  plan.capcutUserData ||
  (plan.draftsRoot
    ? path.dirname(path.dirname(path.resolve(plan.draftsRoot)))
    : PADRAO_USER_DATA
      ? path.join(os.homedir(), PADRAO_USER_DATA)
      : null);
if (!capcutUserData) {
  console.error(
    "Sistema " + process.platform + ": não tenho caminho padrão da pasta do CapCut. " + comoApontar,
  );
  process.exit(1);
}
const draftsRoot = plan.draftsRoot || path.join(capcutUserData, "Projects/com.lveditor.draft");
if (!fs.existsSync(draftsRoot)) {
  console.error(
    "Pasta de rascunhos do CapCut não encontrada: " + draftsRoot + "\n" +
      "Onde ver o caminho certo: nas Configurações do CapCut (pasta dos rascunhos), ou no painel " +
      "Detalhes de um projeto aberto. " + comoApontar,
  );
  process.exit(1);
}
// Molde: por padrão a cópia congelada que vem com a skill (assets/molde). Um projeto vivo do
// CapCut muda quando o usuário edita e já quebrou a geração uma vez; só use "template" de propósito.
const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templateDir = plan.template
  ? path.join(draftsRoot, plan.template)
  : path.join(skillDir, "assets", "molde");
// Um projeto só: se "<nome>" já existe e foi criado por este script, o conteúdo dele é
// substituído (com cópia de segurança do anterior). Projetos de outra origem nunca são tocados.
plan.name = plan.name || "TikTok Shop";
const outDir = path.join(draftsRoot, plan.name);
const marker = path.join(outDir, "gerado_por_claude.txt");
const reuse = fs.existsSync(outDir);
if (reuse && !fs.existsSync(marker)) {
  console.error("O projeto \"" + plan.name + "\" já existe e não foi criado por este script; não vou alterar.");
  process.exit(1);
}
// Projeto aberto no CapCut: ele mantém a versão antiga na memória e grava por cima do que for
// gerado aqui (aconteceu em 12/10). O sinal muda de sistema, mas o modo de falhar é o mesmo:
// na dúvida, parar sem alterar nada. "--forcar" passa por cima.
//   Windows  o arquivo aberto fica travado, então renomear um clipe do projeto atual falha.
//   macOS    renomear arquivo em uso funciona e essa checagem passaria sempre. Aqui o sinal é
//            o lsof em cada clipe do projeto atual. Se o lsof não acusar nada mas o CapCut
//            estiver rodando, não há como saber daqui se ele está na tela inicial ou com o
//            projeto aberto: o script para e pede essa confirmação.
const clipesDoProjeto = () => {
  try {
    const current = JSON.parse(fs.readFileSync(path.join(outDir, "draft_content.json"), "utf8"));
    return [...new Set(current.materials.videos.map((video) => video.path))].filter(
      (file) => file && fs.existsSync(file),
    );
  } catch {
    return []; // sem conteúdo legível: nada a checar
  }
};
const emUsoWindows = (files) => {
  for (const file of files) {
    try {
      fs.renameSync(file, file + ".chk");
      fs.renameSync(file + ".chk", file);
    } catch {
      return file;
    }
  }
  return "";
};
// Roda um utilitário e devolve a saída. ok: false só quando o programa não existe — sair com
// código diferente de zero ainda é resposta (o lsof sai 1 quando ninguém abriu o arquivo).
const correr = (cmd, args) => {
  try {
    return { ok: true, saida: execFileSync(cmd, args, { stdio: ["ignore", "pipe", "ignore"] }).toString() };
  } catch (error) {
    if (typeof error.status === "number") return { ok: true, saida: String(error.stdout || "") };
    return { ok: false, saida: "" };
  }
};
// Devolve { arquivo } com o clipe aberto pelo CapCut (string vazia = nenhum), ou null quando não
// há lsof para responder. O "-Fc" traz o nome do processo, para um clipe aberto por outra coisa
// (Spotlight, pré-visualização) não virar falso "projeto aberto". No macOS o lsof fica em
// /usr/sbin, que nem sempre está no PATH do node.
const emUsoUnix = (files) => {
  if (!files.length) return { arquivo: "" };
  for (const lsof of ["lsof", "/usr/sbin/lsof"]) {
    let respondeu = false;
    for (const file of files) {
      const resultado = correr(lsof, ["-Fc", file]);
      if (!resultado.ok) {
        respondeu = false;
        break;
      }
      respondeu = true;
      if (/^c.*capcut/im.test(resultado.saida)) return { arquivo: file };
    }
    if (respondeu) return { arquivo: "" };
  }
  return null;
};
// true/false, ou null quando não há pgrep para responder.
const capcutRodando = () => {
  for (const args of [["-i", "-x", "CapCut"], ["-i", "-f", "CapCut.app"]]) {
    const resultado = correr("pgrep", args);
    if (!resultado.ok) return null;
    if (resultado.saida.trim()) return true;
  }
  return false;
};
const avisarEParar = (mensagem) => {
  console.error(mensagem + " Nada foi alterado.");
  process.exit(2);
};
if (reuse && !process.argv.includes("--forcar")) {
  const files = clipesDoProjeto();
  const emUso = WINDOWS ? { arquivo: emUsoWindows(files) } : emUsoUnix(files);
  if (emUso && emUso.arquivo) {
    avisarEParar(
      "PROJETO ABERTO NO CAPCUT: o clipe \"" + path.basename(emUso.arquivo) + "\" está em uso. " +
        "Peça para ele voltar à tela inicial do CapCut e gere de novo.",
    );
  }
  if (!WINDOWS) {
    const rodando = capcutRodando();
    if (rodando === true) {
      avisarEParar(
        "CAPCUT ABERTO: nenhum clipe do projeto aparece em uso, mas o CapCut está rodando e daqui " +
          "não dá para saber se o projeto está aberto. O caminho limpo é pedir para ele fechar o " +
          "CapCut e gerar de novo; se ele preferir só voltar à tela inicial, peça essa " +
          "confirmação e rode de novo com --forcar.",
      );
    }
    if (!emUso || rodando === null) {
      avisarEParar(
        "SEM COMO CHECAR O CAPCUT: faltam lsof e/ou pgrep neste sistema, então não sei dizer se o " +
          "projeto está aberto. Peça para ele confirmar que o CapCut está na tela inicial e gere " +
          "de novo com --forcar.",
      );
    }
  }
}
let existingMeta = null;
let existingTimelineId = null;
let backupPath = "";
if (reuse) {
  existingMeta = JSON.parse(fs.readFileSync(path.join(outDir, "draft_meta_info.json"), "utf8"));
  try {
    existingTimelineId = JSON.parse(
      fs.readFileSync(path.join(outDir, "Timelines", "project.json"), "utf8"),
    ).main_timeline_id;
  } catch {
    existingTimelineId = null;
  }
  // Uma cópia só do conteúdo anterior, sobrescrita a cada geração (não acumula).
  const backupDir = path.dirname(plan.mediaDir);
  fs.mkdirSync(backupDir, { recursive: true });
  backupPath = path.join(backupDir, "_projeto-anterior.json");
  fs.copyFileSync(path.join(outDir, "draft_content.json"), backupPath);
}

if (!fs.existsSync(path.join(templateDir, "draft_content.json"))) {
  console.error("Projeto molde não encontrado: " + templateDir);
  process.exit(1);
}

const uuid = () => crypto.randomUUID().toUpperCase();
const clone = (value) => JSON.parse(JSON.stringify(value));
const us = (frames) => Math.round((frames * 1e6) / fps); // frames do projeto -> microssegundos
const slash = (p) => p.replace(/\\/g, "/");

// O molde congelado guarda os caminhos da instalação do CapCut como {{CAPCUT_USER_DATA}}, para
// não levar consigo o caminho de quem o gerou. Aqui eles voltam a apontar para esta máquina.
const lerMolde = (file) =>
  JSON.parse(
    fs
      .readFileSync(path.join(templateDir, file), "utf8")
      .split("{{CAPCUT_USER_DATA}}")
      .join(slash(capcutUserData)),
  );
const template = lerMolde("draft_content.json");
const templateMeta = lerMolde("draft_meta_info.json");

// A fonte da headline mora no cache de fontes do CapCut (.../User Data/Cache/effect/<id da
// fonte>/<versão>/<arquivo>). O {{CAPCUT_USER_DATA}} acima já apontou a raiz para esta máquina,
// mas a pasta da versão é a do computador onde o molde foi feito: se aqui o CapCut baixou a
// fonte em outra versão, usa o mesmo arquivo na versão que existe. Se a fonte nunca foi baixada
// nesta máquina, sai um "avisoFonte" na saída, em vez de o CapCut cair calado em outra fonte.
let fontWarning = "";
const localFont = (original) => {
  const match = slash(original || "").match(/Cache\/effect\/([^/]+)\/[^/]+\/([^/]+)$/);
  if (!match) return original;
  if (fs.existsSync(original)) return slash(original);
  const effectDir = path.join(capcutUserData, "Cache", "effect", match[1]);
  try {
    for (const version of fs.readdirSync(effectDir)) {
      const candidate = path.join(effectDir, version, match[2]);
      if (fs.existsSync(candidate)) return slash(candidate);
    }
  } catch {
    // fonte nunca baixada neste computador
  }
  fontWarning =
    "A fonte da headline (" + match[2] + ") não está no cache do CapCut deste computador. " +
    "Se o texto aparecer com outra fonte, peça para ele escolher a fonte Classic no texto uma vez.";
  return slash(original);
};
const videoTrackTpl = template.tracks.find((track) => track.type === "video");
const textTrackTpl = template.tracks.find((track) => track.type === "text");
const videoSegTpl = videoTrackTpl.segments[0];
const textSegTpl = textTrackTpl.segments[0];
const videoMatTpl = template.materials.videos[0];
const textMatTpl = template.materials.texts[0];

// Materiais auxiliares que cada segmento de vídeo referencia, na ordem do molde.
const auxKinds = [
  "speeds",
  "placeholder_infos",
  "canvases",
  "sound_channel_mappings",
  "material_colors",
  "loudnesses",
  "vocal_separations",
].filter((kind) => (template.materials[kind] || []).length > 0);
const auxTpl = {};
for (const kind of auxKinds) auxTpl[kind] = template.materials[kind][0];

// Copia os clipes para uma pasta estável e lê a duração de cada um.
fs.mkdirSync(plan.mediaDir, { recursive: true });
const files = new Map();
for (const clip of plan.clips) {
  if (files.has(clip.file)) continue;
  const target = path.join(plan.mediaDir, path.basename(clip.file));
  if (!fs.existsSync(target)) fs.copyFileSync(clip.file, target);
  const probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,nb_frames,r_frame_rate",
      "-of", "json", target,
    ]).toString(),
  ).streams[0];
  files.set(clip.file, {
    path: slash(target),
    name: path.basename(target),
    width: probe.width,
    height: probe.height,
    fps: (() => { const [a, b] = probe.r_frame_rate.split("/").map(Number); return b ? a / b : a; })(),
    durationUs: 0,
    materialId: uuid(),
    localId: crypto.randomUUID(),
  });
  const added = files.get(clip.file);
  added.durationUs = Math.floor((Number(probe.nb_frames) * 1e6) / added.fps);
}

const draft = clone(template);
draft.id = existingTimelineId || uuid();
draft.fps = fps;
draft.name = "";
const nowUs = Date.now() * 1000;
draft.create_time = 0;
draft.update_time = 0;

for (const kind of auxKinds) draft.materials[kind] = [];
draft.materials.videos = [];
draft.materials.texts = [];
draft.materials.material_animations = [];

for (const info of files.values()) {
  const material = clone(videoMatTpl);
  material.id = info.materialId;
  material.unique_id = crypto.randomBytes(16).toString("hex");
  material.local_material_id = info.localId;
  material.path = info.path;
  material.material_name = info.name;
  material.duration = info.durationUs;
  material.width = info.width;
  material.height = info.height;
  draft.materials.videos.push(material);
}

// Trava de corte limpo: nenhum clipe pode conter pedaço de outro plano.
// Detecta os cortes de cena de cada arquivo e, se o trecho pedido atravessar um corte
// (ou encostar nele com 1 frame de folga), fica só com o maior pedaço contínuo,
// tirando 1 frame de margem do lado do corte. Assim não sobra "cena de 1 s nada a ver"
// na transição. Desligue num clipe específico com "permitirCortes": true.
const cutCache = new Map();
function sceneCuts(file) {
  if (cutCache.has(file)) return cutCache.get(file);
  const info = files.get(file);
  // O showinfo escreve no stderr e o ffmpeg sai com 0, então é spawnSync: o execFileSync
  // devolveria só o stdout (vazio) e a trava ficaria sem nenhum corte para olhar.
  // Sem ffmpeg para responder, a lista fica vazia e a trava não mexe em nada.
  const saida = spawnSync("ffmpeg", [
    "-hide_banner", "-i", file, "-vf", "select='gt(scene,0.10)',showinfo", "-an", "-f", "null", "-",
  ], { encoding: "utf8" });
  const out = String(saida.stderr || "");
  const cuts = [...out.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Math.round(Number(m[1]) * info.fps));
  cutCache.set(file, cuts);
  return cuts;
}
const ajustesDeCorte = [];
for (const clip of plan.clips) {
  if (clip.permitirCortes) continue;
  const s = clip.start;
  const e = clip.start + clip.frames; // exclusivo
  const inside = sceneCuts(clip.file).filter((c) => c > s && c < e + 1).sort((a, b) => a - b);
  if (!inside.length) continue;
  // pedaços contínuos entre os cortes, com 1 frame de margem do lado de cada corte
  const bounds = [s, ...inside, e];
  let best = null;
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = i === 0 ? bounds[i] : bounds[i] + 1;
    const b = i + 1 === bounds.length - 1 ? Math.min(bounds[i + 1], e) : bounds[i + 1] - 1;
    if (b - a > 0 && (!best || b - a > best[1] - best[0])) best = [a, b];
  }
  if (!best || (best[0] === s && best[1] - best[0] === clip.frames)) continue;
  ajustesDeCorte.push({
    arquivo: path.basename(clip.file),
    pedido: [s, clip.frames],
    cortesNoTrecho: inside,
    ficou: [best[0], best[1] - best[0]],
  });
  clip.start = best[0];
  clip.frames = best[1] - best[0];
}

const videoSegments = [];
let cursor = 0; // em frames da timeline
for (const clip of plan.clips) {
  const info = files.get(clip.file);
  const rate = clip.rate || 1;
  // Início arredondado para cima: nunca cai no último quadro do plano anterior.
  const sourceStart = Math.ceil((clip.start * 1e6) / info.fps);
  const sourceSeconds = clip.frames / info.fps;
  const targetStart = us(cursor);
  let timelineFrames;
  let sourceDuration;
  let speed;
  if (rate === 1) {
    timelineFrames = Math.max(1, Math.floor(sourceSeconds * fps + 1e-6));
    sourceDuration = us(cursor + timelineFrames) - targetStart;
    speed = 1;
  } else {
    timelineFrames = Math.max(1, Math.round((sourceSeconds / rate) * fps));
    sourceDuration = Math.floor(sourceSeconds * 1e6) - 1000;
    speed = sourceDuration / (us(cursor + timelineFrames) - targetStart);
  }
  const targetDuration = us(cursor + timelineFrames) - targetStart;

  const refs = [];
  for (const kind of auxKinds) {
    const aux = clone(auxTpl[kind]);
    aux.id = uuid();
    if (kind === "speeds") aux.speed = speed;
    draft.materials[kind].push(aux);
    refs.push(aux.id);
  }

  const segment = clone(videoSegTpl);
  segment.id = uuid();
  segment.material_id = info.materialId;
  segment.source_timerange = { start: sourceStart, duration: sourceDuration };
  segment.target_timerange = { start: targetStart, duration: targetDuration };
  segment.speed = speed;
  segment.volume = 0;
  segment.last_nonzero_volume = 1;
  segment.extra_material_refs = refs;
  segment.keyframe_refs = [];
  segment.common_keyframes = [];
  videoSegments.push(segment);
  cursor += timelineFrames;
}
const totalUs = us(cursor);
draft.duration = totalUs;

const tracks = [];
const videoTrack = clone(videoTrackTpl);
videoTrack.id = uuid();
videoTrack.segments = videoSegments;
tracks.push(videoTrack);

if (plan.text) {
  const animation = { id: uuid(), type: "sticker_animation", animations: [], multi_language_current: "none" };
  draft.materials.material_animations.push(animation);

  const textMaterial = clone(textMatTpl);
  textMaterial.id = uuid();
  textMaterial.font_path = localFont(textMaterial.font_path);
  for (const font of textMaterial.fonts || []) font.path = localFont(font.path);
  const content = JSON.parse(textMatTpl.content);
  content.text = plan.text;
  content.styles = [Object.assign({}, content.styles[0], { range: [0, plan.text.length] })];
  if (content.styles[0].font) {
    content.styles[0].font = Object.assign({}, content.styles[0].font, {
      path: localFont(content.styles[0].font.path),
    });
  }
  textMaterial.content = JSON.stringify(content);
  draft.materials.texts.push(textMaterial);

  const textSegment = clone(textSegTpl);
  textSegment.id = uuid();
  textSegment.material_id = textMaterial.id;
  textSegment.target_timerange = { start: 0, duration: totalUs };
  textSegment.extra_material_refs = [animation.id];
  const textTrack = clone(textTrackTpl);
  textTrack.id = uuid();
  textTrack.segments = [textSegment];
  tracks.push(textTrack);
}
draft.tracks = tracks;

// Grava a pasta do projeto.
const timelineDir = path.join(outDir, "Timelines", draft.id);
fs.mkdirSync(timelineDir, { recursive: true });
const draftJson = JSON.stringify(draft);
for (const dir of [outDir, timelineDir]) {
  fs.writeFileSync(path.join(dir, "draft_content.json"), draftJson);
  // Cópias que o CapCut mantém do conteúdo: atualiza as que existirem, para ele não recuperar a versão antiga.
  for (const copy of ["draft_content.json.bak", "template-2.tmp"]) {
    if (fs.existsSync(path.join(dir, copy))) fs.writeFileSync(path.join(dir, copy), draftJson);
  }
}
// Mídias das sequências anteriores ("Mídia perdida" em vermelho na biblioteca do projeto).
// O CapCut guarda uma base antiga em attachment/patch/mini_draft.json e uma lista de mídias em
// draft_agency_config.json; com a sequência nova elas reaparecem como mídia perdida. A base antiga
// vai para mini_draft.json.old (sobrescrita a cada geração) e a lista fica só com os clipes atuais.
for (const tlDir of fs.existsSync(path.join(outDir, "Timelines")) ? fs.readdirSync(path.join(outDir, "Timelines")) : []) {
  const patchDir = path.join(outDir, "Timelines", tlDir, "attachment", "patch");
  const mini = path.join(patchDir, "mini_draft.json");
  if (fs.existsSync(mini)) fs.renameSync(mini, mini + ".old");
  if (fs.existsSync(path.join(patchDir, "patch.json"))) fs.writeFileSync(path.join(patchDir, "patch.json"), JSON.stringify({ patch_data: [] }));
}
const agencyPath = path.join(outDir, "draft_agency_config.json");
if (fs.existsSync(agencyPath)) {
  try {
    const agency = JSON.parse(fs.readFileSync(agencyPath, "utf8"));
    const atuais = new Set([...files.values()].map((info) => info.path));
    if (Array.isArray(agency.marterials)) agency.marterials = agency.marterials.filter((m) => atuais.has(m.source_path));
    fs.writeFileSync(agencyPath, JSON.stringify(agency));
  } catch {}
}
const projectJsonPath = path.join(outDir, "Timelines", "project.json");
if (!(reuse && existingTimelineId)) fs.writeFileSync(
  projectJsonPath,
  JSON.stringify({
    config: {
      color_space: -1,
      hdr_vivid: false,
      mixed_track_mode_on: false,
      render_index_track_mode_on: false,
      use_float_render: false,
    },
    create_time: nowUs,
    id: uuid(),
    main_timeline_id: draft.id,
    timelines: [
      { create_time: nowUs, id: draft.id, is_marked_delete: false, name: "Linha do tempo 01", update_time: nowUs },
    ],
    update_time: nowUs,
    version: 0,
  }),
);

const meta = clone(existingMeta || templateMeta);
const nowSeconds = Math.floor(Date.now() / 1000);
if (!existingMeta) meta.draft_id = uuid();
meta.draft_name = plan.name;
meta.draft_fold_path = slash(outDir);
meta.draft_root_path = slash(draftsRoot);
meta.draft_cover = "draft_cover.jpg";
meta.cloud_draft_cover = false;
meta.cloud_draft_sync = false;
meta.cloud_package_completed_time = "";
meta.tm_draft_cloud_completed = "";
meta.tm_draft_cloud_entry_id = -1;
meta.tm_draft_cloud_modified = 0;
meta.tm_draft_cloud_parent_entry_id = -1;
if (!existingMeta) meta.tm_draft_create = nowUs;
meta.tm_draft_modified = nowUs;
meta.tm_draft_removed = 0;
meta.tm_duration = totalUs;
meta.draft_timeline_materials_size_ = 0;
const materialSample = (templateMeta.draft_materials.find((entry) => entry.type === 0) || { value: [] }).value[0] || {};
meta.draft_materials = templateMeta.draft_materials.map((entry) => ({ type: entry.type, value: [] }));
const videoEntry = meta.draft_materials.find((entry) => entry.type === 0);
for (const info of files.values()) {
  videoEntry.value.push(
    Object.assign(clone(materialSample), {
      create_time: nowSeconds,
      duration: info.durationUs,
      extra_info: info.name,
      file_Path: info.path,
      height: info.height,
      width: info.width,
      id: info.localId,
      import_time: nowSeconds,
      import_time_ms: nowUs,
      metetype: "video",
      roughcut_time_range: { duration: info.durationUs, start: 0 },
      sub_time_range: { duration: -1, start: -1 },
      type: 0,
    }),
  );
}
fs.writeFileSync(path.join(outDir, "draft_meta_info.json"), JSON.stringify(meta));
fs.writeFileSync(marker, "Projeto gerado pelo script capcut-draft.mjs. Pode ser substituído por ele.");

// Capa: um quadro do segundo plano (o primeiro costuma ser a cama vazia).
try {
  const coverClip = plan.clips[Math.min(1, plan.clips.length - 1)];
  const coverInfo = files.get(coverClip.file);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String((coverClip.start + 2) / coverInfo.fps), "-i", coverInfo.path,
    "-frames:v", "1", "-vf", "scale=540:960", path.join(outDir, "draft_cover.jpg"),
  ]);
} catch (error) {
  console.error("Capa não gerada: " + error.message);
}

// Folha de conferência: primeiro e último quadro de cada clipe do plano, na ordem.
let checkSheet = "";
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "capcut-conf-"));
  plan.clips.forEach((clip, index) => {
    const info = files.get(clip.file);
    const last = clip.start + clip.frames - 1;
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", info.path,
      "-vf", "select='eq(n\," + clip.start + ")+eq(n\," + last + ")',setpts=N/TB,scale=180:320,tile=2x1",
      "-frames:v", "1", "-fps_mode", "vfr", path.join(tmp, "t_" + String(index).padStart(3, "0") + ".jpg"),
    ]);
  });
  checkSheet = path.join(plan.mediaDir, "conferencia.jpg");
  const columns = Math.min(5, plan.clips.length);
  const rowsCount = Math.ceil(plan.clips.length / columns);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-framerate", "1",
    "-i", path.join(tmp, "t_%03d.jpg"),
    "-vf", "tile=" + columns + "x" + rowsCount + ":padding=6", "-frames:v", "1", "-q:v", "3", checkSheet,
  ]);
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (error) {
  console.error("Folha de conferência não gerada: " + error.message);
}

// Limpeza: a sequência anterior já foi concluída (o "próximo" do usuário), então os clipes
// copiados e a folha de conferência dela vão para a Lixeira. A pasta da sequência atual fica,
// porque o projeto do CapCut depende dela até ele exportar.
const statePath = path.join(path.dirname(plan.mediaDir), "_ultimo.json");
const cleaned = [];
const pending = [];
try {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  // Pastas que não saíram em tentativas anteriores (arquivo aberto no CapCut) entram de novo.
  const queue = [...new Set([...(state.pendentes || []), state.mediaDir].filter(Boolean))];
  for (const dir of queue) {
    if (path.resolve(dir) === path.resolve(plan.mediaDir) || !fs.existsSync(dir)) continue;
    const result = enviarParaLixeira(dir);
    if (!result.ok) {
      result.motivo = "não saiu agora (provável arquivo aberto no CapCut); tento de novo na próxima geração";
      pending.push(slash(path.resolve(dir)));
    }
    cleaned.push(result);
  }
} catch {
  // sem registro anterior: nada a limpar
}
fs.writeFileSync(
  statePath,
  JSON.stringify({ mediaDir: slash(path.resolve(plan.mediaDir)), pendentes: pending }),
);

// Confere, alguns segundos depois, se o CapCut não gravou a versão antiga por cima.
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 6000);
let confirmed = false;
try {
  const after = JSON.parse(fs.readFileSync(path.join(outDir, "draft_content.json"), "utf8"));
  confirmed =
    after.tracks[0].segments.length === videoSegments.length &&
    after.tracks[0].segments[0].id === videoSegments[0].id;
} catch {
  confirmed = false;
}

console.log(
  JSON.stringify(
    {
      projeto: plan.name,
      gravacaoConfirmada: confirmed,
      modo: reuse ? "substituiu o conteúdo do projeto existente" : "criou o projeto",
      copiaDoAnterior: slash(backupPath),
      pasta: slash(outDir),
      clipes: plan.clips.length,
      arquivos: files.size,
      duracaoSegundos: Number((totalUs / 1e6).toFixed(2)),
      ajustesDeCorte,
      fps,
      conferencia: slash(checkSheet),
      limpeza: cleaned,
      ...(fontWarning ? { avisoFonte: fontWarning } : {}),
    },
    null,
    2,
  ),
);
