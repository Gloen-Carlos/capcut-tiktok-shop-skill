---
name: video-tiktok-shop
description: Monta vídeos de produto para TikTok Shop a partir de clipes gerados por IA (mãos mostrando roupas numa cama ou tapete), como projeto editável do CapCut desktop. Agrupa a pasta por produto, revisa cada clipe quadro a quadro, corta os bugs que mostram o produto errado, monta no formato certo (entrada e saída com as mãos, ou kit empilhado), gera o projeto do CapCut já com a headline e entrega um relatório curto. Use sempre que o usuário mandar a pasta de clipes, anexar clipes .mp4 de produto, disser "mais um", "próximo", "outro", "edita esses", "monta no capcut", pedir headline ou texto para esses vídeos, ou quiser continuar esse trabalho numa sessão nova, mesmo que só mande os arquivos sem explicar nada.
---

# Vídeos de produto para TikTok Shop

O usuário gera clipes curtos por IA (720x1280, 24 fps, 8 a 10 s, mãos mostrando peças de roupa) e quer cada produto montado como um vídeo vertical pronto para o TikTok Shop. Esta skill foi escrita para um usuário que fala português, escreve de forma curta e informal, e espera que você trabalhe sem perguntar o óbvio. Responda sempre em português.

Duas coisas valem mais que todo o resto:

1. **Não mostrar o produto errado.** Clipes de IA mudam estampa, cor, número de listras, logo e acessórios de um plano para o outro. Um anúncio que mostra algo que a peça não tem engana quem compra, então esses trechos saem.
2. **Entregar como projeto do CapCut, editável.** Ele edita e exporta no CapCut desktop. Você gera o projeto (rascunho) direto na pasta do CapCut, com um clipe por plano. Não renderize um MP4 pronto; ele quer ajustar na timeline.

## Antes da primeira sessão

Esta skill grava em duas pastas:

- **Pasta de entrada:** de onde vêm os clipes. Não é fixa — é a que o usuário indicar (por exemplo a pasta de downloads dele). Pergunte uma vez e guarde na memória da sessão.
- **Pasta de trabalho:** para onde os clipes usados são copiados e onde ficam as folhas de conferência. Vem de `$TIKTOK_SHOP_WORKDIR`; sem essa variável, é `<home>/tiktok-shop`. O `mediaDir` de cada sequência tem de ficar **dentro** dela, senão a limpeza se recusa a mexer (veja "Limpeza").

Precisa de `ffmpeg`, `ffprobe` e `node` no PATH, e do CapCut desktop instalado.

## Fluxo de uma sessão

### 1. Receber a pasta e separar por produto

Ele costuma mandar uma pasta com clipes de vários produtos misturados. Rode o script de análise para ver tudo de uma vez:

```bash
bash "<pasta-desta-skill>/scripts/analisar.sh" "<pasta-de-entrada>" "<scratchpad>/analise"
```

Ele imprime, por clipe, o número de frames e os frames onde há corte, e gera `visao-geral.jpg` (uma linha por clipe) e `cN.jpg` (folha numerada por frame). Leia a visão geral e agrupe os clipes por produto e cenário.

Trabalhe **uma sequência por vez**: monte a primeira, entregue, e diga quais outras encontrou na pasta. Só passe para a seguinte quando ele disser "próximo". Use apenas os clipes da pasta que ele indicou.

### 2. Identificar o formato

Há dois formatos. Diga na entrega qual usou.

**Formato 1 (o mais comum).** Sinais: clipes de detalhe com closes e macros, um por cor ou peça, cada um com 5 a 8 cortes internos de cerca de 1 s; mais um clipe único de entrada e saída.

| Bloco | Duração | Conteúdo |
|---|---|---|
| Entrada | 2,5 a 3,5 s | Cama vazia, as mãos colocam cada peça até assentar |
| Detalhes | cerca de 1,1 s por plano | Um bloco por cor, 5 ou 6 planos cada |
| Saída | 2,5 a 3,5 s | As mãos retiram todas as peças, termina na cama vazia |

- A ordem dos blocos segue a ordem em que as peças entram na cama.
- Dentro de um bloco, mantenha a ordem do clipe original.
- A entrada mostra a colocação inteira e a saída vai até a cama vazia. Encurtar isso foi reclamado duas vezes. Acelere no máximo 1,3x e não corte trechos do movimento.
- O clipe de entrada e saída quase sempre termina com as peças reaparecendo de repente na cama vazia. Pare a saída antes desse corte.
- Se o clipe só tiver a entrada, feche com as peças juntas e avise que falta uma tomada de saída.

**Formato 2 (kit empilhado).** Sinais: todos os clipes no mesmo plano aberto, com as peças empilhadas em leque, sem macro.

Os clipes desse formato costumam vir assim: um clipe curto (6 s) das peças já arrumadas com as mãos esticando a da frente, dois clipes de detalhe de 10 s sem cortes internos, e um clipe de entrada e saída. A ordem definida pelo usuário, medida numa referência de 16,9 s:

| Bloco | Duração | Conteúdo |
|---|---|---|
| Gancho | até 3 s | Peças já arrumadas, as mãos esticando a da frente. Se o clipe tiver duas esticadas, mostre as duas; se tiver uma, só uma |
| Colocação | cerca de 3,4 s | Superfície vazia, as mãos colocam as peças de trás para a frente |
| Detalhes | cerca de 8 s no total | Os outros dois clipes, um trecho contínuo de cada (2 a 4,5 s), no plano aberto |
| Saída | cerca de 2,7 s | As mãos retiram as peças até a superfície ficar vazia |

- O gancho nunca passa de 3 s.
- Nos detalhes, escolha o trecho de cada clipe em que algo acontece (peça erguida, transparência, outra cor trazida para a frente) e corte as partes paradas.
- Se a pasta só tiver um clipe de detalhe para o kit, use dois trechos dele.
- A saída pode ser acelerada até 1,3x. Se não houver clipe de saída, termine no último detalhe.

O que é igual nos dois: 9:16 em 1080x1920, sem som, bugs cortados, mesma headline na mesma posição.

### 3. Caçar os bugs de produto

Olhe a folha numerada de cada clipe e compare cada plano com o plano aberto da mesma peça. Amplie os quadros suspeitos antes de decidir; na folha os defeitos passam.

Os que mais aparecem:

- Estampa, renda ou número de listras diferente do plano aberto.
- Cor que muda (branco que vira bege, azul ou cinza que vira preto).
- Acessório que surge ou some: cordão, etiqueta, bolso, fenda, zíper, logo duplicado ou em outra perna.
- Desenho que muda entre tomadas (alças retas numa, em X na outra; gola alta que vira capuz).
- Peça erguida, dobrada ou virada que fica inflada, embolada ou irreconhecível.
- Mãos que mudam (com luva num plano, sem luva no outro).

Como decidir:

- Plano inteiro errado sai inteiro. Metade boa: fique só com ela, se sobrar pelo menos 0,6 s.
- Na dúvida sobre um defeito pequeno, corte; sobra material.
- Quando duas tomadas discordam sobre como a peça é, pergunte. Vale o que ele disser, mesmo que a maioria das tomadas mostre outra coisa.
- Bug dentro da entrada ou da saída: mantenha o movimento inteiro e avise no relatório. O conserto é ele gerar outra tomada.

### 4. Gerar o projeto no CapCut

Escreva um plano em JSON no scratchpad e rode o gerador:

```json
{
  "name": "TikTok Shop",
  "mediaDir": "<pasta-de-trabalho>/<produto>",
  "text": "Linha 1\nLinha 2",
  "clips": [
    { "file": "<pasta-de-entrada>/entrada.mp4", "start": 16, "frames": 84, "rate": 1.3 },
    { "file": "<pasta-de-entrada>/detalhe.mp4", "start": 0, "frames": 27 }
  ]
}
```

```bash
node "<pasta-desta-skill>/scripts/capcut-draft.mjs" "<scratchpad>/plano.json"
```

- `start` e `frames` são frames do arquivo de origem (os que o script de análise mostra). `rate` é a aceleração, só na entrada e na saída.
- **Um projeto só, chamado "TikTok Shop".** Ele pediu para não criar um projeto novo a cada vídeo. O script reaproveita esse projeto e substitui o conteúdo dele pela sequência atual, guardando uma única cópia do conteúdo anterior em `<pasta acima do mediaDir>/_projeto-anterior.json`, sobrescrita a cada geração. Por isso:
  - Antes de gerar a próxima sequência, confirme que ele já exportou a anterior (o "próximo" dele vale como confirmação).
  - O projeto precisa estar fechado no CapCut na hora de gerar (CapCut na tela inicial). Com ele aberto, o CapCut grava a versão antiga por cima e a montagem nova some. O script aborta com "PROJETO ABERTO NO CAPCUT" quando percebe isso; nesse caso peça para ele voltar à tela inicial e gere de novo. Confira `gravacaoConfirmada: true` na saída.
  - Se ele disser que a sequência não apareceu, veja se o `draft_content.json` do projeto voltou ao conteúdo antigo e rode o gerador de novo com o mesmo plano.
  - O script só substitui projetos que ele mesmo criou (marcados com `gerado_por_claude.txt`) e se recusa a tocar em qualquer outro.
- **Taxa:** o projeto sai em 30 fps. Não mude sem ele pedir.
- **Clipes:** o script copia os arquivos para `mediaDir`, porque a pasta de entrada costuma ser esvaziada entre trabalhos e o projeto perderia os vídeos.
- **Molde:** o script usa a cópia congelada em `assets/molde` (campos do projeto e o estilo da headline). Não aponte para um projeto vivo do CapCut: um molde que o usuário edita muda sob os seus pés e quebra a geração. Se ele pedir para atualizar o estilo da headline, copie para `assets/molde` o `draft_content.json` de um projeto "TikTok Shop" recém-gerado e ajustado por ele.
- **Projetos dele:** nunca altere nenhum projeto do CapCut que não tenha sido criado por você.
- O CapCut detecta a pasta nova sozinho, mesmo aberto. Se não aparecer, peça para ele fechar e abrir o CapCut.

O script também gera `<mediaDir>/conferencia.jpg`, com o primeiro e o último quadro de cada clipe do plano, na ordem. Leia essa imagem antes de entregar: confira se a entrada começa vazia, se nenhum plano cortado voltou, se cada par é do mesmo plano e se a saída termina onde planejou.

Você não vê a timeline do CapCut. Diga na entrega que conferiu por quadros dos clipes e peça para ele dar play.

### Limpeza a cada "próximo"

Ele pediu para não encher o disco: depois que uma sequência é concluída e ele diz "próximo", as cópias dos clipes, as imagens de conferência e as cópias de projeto dela devem sair.

- **Clipes e conferência da sequência anterior:** o gerador cuida disso sozinho. Ao gerar a sequência nova, ele manda para a Lixeira a pasta `mediaDir` da anterior (o campo `limpeza` da saída mostra o que saiu). Use sempre um `mediaDir` novo por sequência, dentro da pasta de trabalho.
- **Folhas de análise:** quando a última sequência de uma pasta for gerada, mande a pasta de análise dela para a Lixeira:

  ```bash
  node "<pasta-desta-skill>/scripts/lixeira.mjs" "<scratchpad>/analise"
  ```

- **A sequência atual fica** até a próxima geração, porque o projeto do CapCut depende dos clipes dela até ele exportar.
- Tudo vai para a Lixeira do Windows, nada é apagado de forma definitiva. O espaço só é liberado quando ele esvazia a Lixeira; diga isso se ele perguntar por espaço em disco. O `lixeira.mjs` recusa qualquer caminho fora da pasta de trabalho (`$TIKTOK_SHOP_WORKDIR`) e da pasta temporária do Claude; não contorne essa trava com `rm`.

### 5. Headline

O campo `text` do plano vira a headline. O estilo vem do molde: fonte Classic do CapCut em negrito, branca com contorno preto, numa posição fixa do início ao fim. Por ser cópia de um projeto real, sai idêntica; não tente ajustar fonte ou tamanho.

Escreva a frase em duas linhas, com `\n` no ponto da quebra, deixando as linhas com tamanho parecido.

Como escrever a frase:

- Fale com o público da peça. Roupa masculina pede linguagem para homem (nada de "linda", "blusinha"). Diga na entrega qual público assumiu.
- Sem preço nem valores.
- Não prometa efeito no corpo nem nada que o anúncio não sustente.
- Até uns 50 caracteres, sem emoji, sem ponto final, "tiktok" em minúsculo.
- Baseie no print do anúncio, se ele mandar; sem print, no que o vídeo mostra.

Fórmulas já usadas e aprovadas:

- Achei o/a [peça] mais [lindo/estiloso] do tiktok
- Não sabia qual cor escolher então levei as três
- POV: a academia inteira perguntando onde comprei
- O [peça] que resolve o look de qualquer rolê
- Simplesmente o kit de [peça] mais lindo que já vi!
- Minha meta era economizar, mas esse short não deixou!

### 6. Entregar

Responda neste formato, curto, e pare aí:

```
A [n]ª sequência está no CapCut, no projeto "TikTok Shop": [produto e cores].
Conferi quadros dos clipes, e vale abrir e dar play.

É o formato [1 ou 2], com X s, em 9:16 (1080x1920), 30 fps, sem som.

## Como está a timeline
- Entrada (X s): ...
- [Cor] (N planos): ...
- Saída (X s): ...
- Texto: "..."

## O que cortei
- [Onde]: [o que estava errado]

## Pontos para você conferir
(só dúvidas reais sobre o produto, ou tomadas que faltam)

## Outras frases para o texto
Assumi público [feminino/masculino].
1. ...

[Quais sequências faltam na pasta, e o lembrete: exporte esta antes de pedir a próxima,
porque a próxima substitui o conteúdo do projeto]
```

Mande as frases alternativas como frase corrida, sem barra marcando quebra de linha.

## O que não fazer

- Não altere, renomeie nem apague projetos do CapCut que não foram criados por você, e não mexa no `root_meta_info.json`.
- Não apague arquivos com `rm`; a limpeza é sempre pelo `lixeira.mjs`.
- Não exporte nem gere MP4 sem ele pedir.
- Não aplique zoom nem movimento de câmera. Se ele falar em "keyframes" sem explicar, pergunte o que quer.
- Não monte todas as sequências da pasta de uma vez.

## Se ele pedir no ChatCut

Antes do CapCut, as montagens eram feitas no ChatCut (editor online). Só use esse caminho se ele pedir. Nesse caso carregue a skill `chatcut:chatcut-plugin-basics-claude`, crie o projeto em 1080x1920 a 24 fps, suba os clipes com `import_media` (`create_session`) e o helper `upload-media.mjs` com `--no-transcribe`, monte com `edit_item` e use a headline de `references/headline.md`.
