# capcut-tiktok-shop-skill

Skill de [Claude Code](https://claude.com/claude-code) que monta vídeos de produto para TikTok Shop a partir de clipes gerados por IA e entrega o resultado como **projeto editável do CapCut desktop** — não como um MP4 pronto.

A ideia: você gera no seu gerador de vídeo por IA um punhado de clipes de 8 a 10 s (mãos mostrando peças de roupa numa cama ou tapete), joga a pasta para o Claude e ele devolve a timeline montada, com os bugs de produto já cortados e a headline no lugar. Você abre o CapCut, confere, ajusta e exporta.

## Por que existe

Clipes de roupa gerados por IA mentem sobre o produto. Entre um plano e outro muda a estampa, o número de listras, a cor, o logo, aparece um cordão que a peça não tem. Montar esses clipes sem revisar quadro a quadro produz um anúncio que mostra algo que o cliente não vai receber.

Esta skill trata isso como a regra número um: cada clipe é aberto como folha de contato numerada por frame, comparado com o plano aberto da mesma peça, e os trechos divergentes saem antes da montagem.

## O que ela monta

Dois formatos, identificados pelos próprios clipes:

**Formato 1 — entrada, detalhes, saída.** Cama vazia, as mãos colocam as peças, blocos de close por cor (cerca de 1,1 s por plano), e as mãos retirando tudo até a cama ficar vazia de novo.

**Formato 2 — kit empilhado.** Gancho com as peças já arrumadas, colocação de trás para a frente, dois trechos de detalhe em plano aberto, saída.

Nos dois: 9:16 em 1080x1920, 30 fps, sem som, headline fixa em branco com contorno preto.

## Requisitos

- Windows ou macOS (o gerador escreve na pasta de rascunhos do CapCut desktop e a limpeza usa a Lixeira do sistema) — veja [No Mac](#no-mac)
- CapCut desktop
- `node` 18+
- `ffmpeg` e `ffprobe` no PATH

## No Mac

Funciona. Os scripts escolhem o caminho conforme o sistema — é detecção de plataforma, o
comportamento no Windows continua o mesmo. O que foi medido e testado num Mac com Apple Silicon:

- **Pasta de rascunhos:** `~/Movies/CapCut/User Data`. O plano continua aceitando
  `"capcutUserData"` ou `"draftsRoot"` se a sua instalação for outra.
- **O arquivo de conteúdo do projeto é `draft_info.json`, não `draft_content.json`.** Com o nome
  do Windows o projeto aparece na lista do CapCut mas não abre. Os projetos reais da máquina
  confirmam: só `draft_info.json`. O molde em `assets/molde/` continua com o nome do Windows, por
  ser arquivo da skill e não projeto do CapCut.
- **Limpeza:** a Lixeira do Finder, pelo `osascript`, com a API do sistema
  (`NSFileManager.trashItemAtURL`) como reserva para quando a automação do Finder estiver negada
  em Privacidade e Segurança. Dá para restaurar com "Colocar de volta". A trava de caminhos
  continua a mesma: nada fora da pasta de trabalho.
- **"Projeto aberto no CapCut":** o sinal é o arquivo `.locked` da pasta do projeto, que o CapCut
  mantém aberto só enquanto o projeto está na timeline (`lsof -c CapCut`). O teste é "aberto
  agora", não "existe", para que um `.locked` deixado por um fechamento anormal não trave a
  geração para sempre. **Os clipes não servem de sinal no Mac:** na tela inicial o CapCut volta a
  abri-los para montar as miniaturas, e usar os clipes dava aborto com o projeto fechado
  (reproduzido). No Windows o sinal continua sendo o rename do clipe em uso.
- **Fonte do carimbo das folhas de contato:** `/System/Library/Fonts/Supplemental/Arial.ttf` por
  padrão, ainda ajustável por `ANALISAR_FONT`.

Requisito que continua valendo nos dois sistemas: **o CapCut desktop precisa estar na tela
inicial, com o projeto fechado, na hora de gerar.** E a headline pode cair numa fonte padrão se o
cache de fontes da sua instalação não tiver a fonte do molde — veja [O molde](#o-molde).

## Instalar

Copie a pasta da skill para as suas skills do Claude Code:

```bash
git clone https://github.com/Gloen-Carlos/capcut-tiktok-shop-skill.git
cp -r capcut-tiktok-shop-skill/skills/video-tiktok-shop ~/.claude/skills/
```

Depois disso `/video-tiktok-shop` aparece no Claude Code. Para usar só no projeto, copie para `.claude/skills/` do repositório em vez da home.

## Configurar

Uma variável, opcional:

| Variável | Para quê | Padrão |
|---|---|---|
| `TIKTOK_SHOP_WORKDIR` | Pasta de trabalho: para onde os clipes usados são copiados, onde ficam as folhas de conferência, e o único lugar de onde a limpeza aceita apagar | `<home>/tiktok-shop` |
| `ANALISAR_FONT` | Fonte do carimbo de número de frame nas folhas de contato | Arial do sistema |

A **pasta de entrada** (de onde vêm os clipes) não é configurada: é a que você indicar na conversa.

## Usar

No Claude Code, normalmente basta mandar a pasta:

```
monta esses: D:\Downloads\clipes-de-hoje
```

Ele analisa a pasta, agrupa por produto, monta **uma** sequência, entrega um relatório curto (o que cortou, o que ficou na timeline, frases alternativas para a headline) e espera. Quando você exportar e disser "próximo", ele monta a seguinte e manda os clipes da anterior para a Lixeira.

### Os scripts, sozinhos

Funcionam fora do Claude, se você quiser só as ferramentas:

```bash
# Folhas de contato numeradas por frame + visão geral da pasta
bash skills/video-tiktok-shop/scripts/analisar.sh <pasta-dos-clipes> <pasta-de-saida>

# Projeto do CapCut a partir de um plano de cortes
node skills/video-tiktok-shop/scripts/capcut-draft.mjs plano.json

# Lixeira (recusa caminhos fora da pasta de trabalho)
node skills/video-tiktok-shop/scripts/lixeira.mjs <caminho>
```

`plano.json`:

```json
{
  "name": "TikTok Shop",
  "mediaDir": "C:/Users/voce/tiktok-shop/polo-3-cores",
  "text": "Achei o polo mais estiloso\ndo tiktok",
  "clips": [
    { "file": "D:/Downloads/clipes/entrada.mp4", "start": 16, "frames": 84, "rate": 1.3 },
    { "file": "D:/Downloads/clipes/detalhe.mp4", "start": 0,  "frames": 27 }
  ]
}
```

`start` e `frames` são frames do arquivo de origem — os números que o `analisar.sh` imprime. `rate` é aceleração (use só na entrada e na saída). O script copia os clipes para `mediaDir`, gera `mediaDir/conferencia.jpg` com o primeiro e o último quadro de cada corte, e imprime um JSON com o que fez.

## O molde

`skills/video-tiktok-shop/assets/molde/` é um projeto do CapCut congelado, de onde saem os campos do rascunho e o estilo da headline. Os caminhos da instalação do CapCut estão gravados como `{{CAPCUT_USER_DATA}}` e são resolvidos para a sua máquina na hora de gerar.

Duas consequências:

- A headline sai com a fonte **Classic** do CapCut porque o molde aponta para o cache de fontes de uma instalação, e o código da pasta de cache muda de uma máquina para outra. O gerador tenta consertar sozinho: quando o caminho do molde não existe, ele procura a mesma fonte, pelo nome, dentro do mesmo pacote de efeito da sua instalação. Se a fonte não estiver lá, o CapCut cai numa fonte padrão; conserto: gere uma sequência, ajuste a headline no CapCut do jeito que você quer, e copie o conteúdo desse projeto para `assets/molde/draft_content.json`.
- Se preferir outro molde, passe `"template": "<nome do projeto>"` no plano para usar um projeto vivo do CapCut. Não é recomendado: se você editar esse projeto, a geração quebra.

## Cuidados

- **Feche o projeto no CapCut antes de gerar.** Com o projeto aberto, o CapCut mantém a versão antiga em memória e grava por cima. O script detecta isso e aborta sem alterar nada.
- **Um projeto só.** Todas as sequências vão para o mesmo projeto, chamado "TikTok Shop", substituindo o conteúdo anterior. Exporte antes de pedir a próxima. O script só substitui projetos que ele mesmo criou (marcados com `gerado_por_claude.txt`) e se recusa a tocar em qualquer outro.
- **Nada é apagado de forma definitiva.** A limpeza manda para a Lixeira do sistema e só aceita caminhos dentro da pasta de trabalho.

## Licença

MIT. Veja [LICENSE](LICENSE).

---

**In English:** a Claude Code skill that turns AI-generated clothing clips into a TikTok Shop product video, delivered as an editable CapCut desktop project rather than a rendered MP4. It contact-sheets every clip frame by frame to cut the shots where the AI changed the product (print, colour, stripe count, logo, phantom drawstrings), assembles one of two vertical formats, and writes the CapCut draft with the headline already in place. Windows and macOS; needs CapCut desktop, Node 18+, ffmpeg. The skill's own instructions are in Portuguese.
