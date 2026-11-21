# Etapas do vídeo e tipos de clipe

O vídeo é dividido em 5 etapas (ou 4, sem gancho): gancho, colocação, dois vídeos de detalhe (passar a mão no produto, tocar no tecido, deslizar por cima, zigue-zague, mostrar 2 peças, sentir o tecido, apresentar os detalhes) e retirada.

Normalmente cada clipe da pasta cobre UMA etapa (alguns cobrem duas, como o de colocar e retirar). Use as tabelas abaixo para reconhecer o papel de cada clipe pelo que aparece no quadro, nunca pelo nome do arquivo.

## As 5 etapas

| # | Etapa | Duração no vídeo | O que é |
|---|---|---|---|
| 1 | Gancho | até 2,10 s (acelerado) | O que prende nos primeiros segundos |
| 2 | Colocação | movimento inteiro, até 1,3x | A superfície começa vazia e as peças chegam |
| 3 | Detalhe 1 | 3 a 4 s | A peça da frente sendo tocada |
| 4 | Detalhe 2 | 3 a 4 s | Outra ação ou o outro produto |
| 5 | Retirada | movimento inteiro, até 1,3x | As peças saem até a superfície ficar vazia |

Quando a pasta não tiver gancho, o vídeo tem 4 etapas e começa na colocação. Quando o gancho já faz a colocação (pacote abrindo e colocando, estalo, aparição), as etapas 1 e 2 viram uma só.

## Etapa 1: tipos de gancho

| O que aparece | Como usar |
|---|---|
| Peças empilhadas, as mãos puxam e esticam a da frente na superfície | Esticada: o trecho das duas puxadinhas, até 2,10 s |
| A peça da frente erguida e esticada no ar várias vezes | Esticada no ar: o par de puxadas mais forte, até 2,10 s |
| Esticada e, no fim, a palma da mão cobre a câmera | Esticada; a mão cobrindo a câmera é transição: fecha o gancho e corta direto para a colocação |
| Saquinho plástico transparente sendo rasgado, a peça dobrada aparece e é erguida | Rasgando o pacote: do início do rasgo até a peça aparecer, até 2,10 s |
| Saquinho plástico aberto pela borda, a peça é puxada para fora | Abrindo o pacote: idem |
| Pacote preto do TikTok Shop aberto e as peças tiradas e colocadas uma a uma | Unboxing: faz o gancho E a colocação. Use o movimento inteiro; o começo parado (chão vazio até o pacote entrar) sai |

## Etapa 2: tipos de colocação

| O que aparece | Como usar |
|---|---|
| Chão vazio, as mãos colocam as peças; depois retiram tudo | Clipe de colocação E retirada: a primeira metade é a etapa 2 e a segunda é a etapa 5 (cada uma em um trecho contínuo) |
| Chão vazio, as mãos fazem um gesto e cada peça aparece de repente, uma por vez (cortes no meio) | Colocação "mágica", no lugar da colocação com as mãos: os cortes são de propósito, use `"permitirCortes": true`; termina quando a última peça aparece |
| Chão vazio com as mãos, corte, as peças aparecem juntas; depois são retiradas | Aparição de uma vez (como o estalo) + retirada; `"permitirCortes": true` no trecho da aparição |
| Unboxing (veja acima) | A colocação já está dentro do unboxing |

## Etapas 3 e 4: ações de detalhe

| O que aparece | Ação |
|---|---|
| Peça esticada, depois erguida, com a mão passando por cima | "Passando a mão no produto": o detalhe 1 clássico |
| Uma mão desliza em zigue-zague por cima da peça deitada | "Deslizar por cima / zigue-zague" |
| Mão tocando e alisando, a câmera chega mais perto do tecido | "Tocar no tecido / sentir o tecido" |
| A peça da frente esticada, depois a outra cor puxada para a frente e alisada | "Mostrar 2 peças": é o detalhe 2 (o outro produto) |
| Vários closes curtos: gola, manga, costura, textura (cortes a cada ~1,1 s) | "Apresentar os detalhes": clipe picotado, `rate` 1.1 |
| Peças paradas, só a câmera se aproxima da peça da frente | Aproximação da câmera: vale como detalhe (etapa 3 ou 4); nunca como gancho |

Escolha dos dois detalhes:
- Detalhe 1 = uma ação de mão na peça da frente (passar a mão, deslizar, tocar, sentir).
- Detalhe 2 = de preferência "mostrar 2 peças" (o outro produto). Sem esse clipe, use outra ação diferente da do detalhe 1, nunca a mesma ação duas vezes.
- "Apresentar os detalhes" (picotado) ou a aproximação da câmera podem ocupar um dos dois se não houver outra ação de mão.
- No formato 1 (closes por cor) os detalhes são um bloco por cor, como está no SKILL.md.

## Etapa 5: tipos de retirada

| O que aparece | Como usar |
|---|---|
| Peças empilhadas, as mãos tiram uma a uma | Retirada pura: do primeiro puxão até o chão vazio, um trecho só |
| Segunda metade do clipe de colocar e retirar | Do primeiro puxão até o chão vazio; pare antes de as peças reaparecerem |

Sem clipe de retirada, o vídeo termina no último detalhe (ou nas peças paradas na superfície).
