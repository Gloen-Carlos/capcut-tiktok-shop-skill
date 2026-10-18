# Headline no ChatCut

Motion Graphic que reproduz a headline de referência (fonte "Classic" do CapCut com negrito ligado). Os números abaixo foram medidos e calibrados; use-os como estão.

## Criar o asset

Chame `create_motion_graphic_from_code` com:

- `name`: "Headline TikTok"
- `width`: 1080, `height`: 220
- `durationInFrames`: duração total da timeline
- `properties`: a lista abaixo, trocando só o `defaultValue` de `text`
- `code`: o bloco JSX abaixo, inteiro

A validação devolve vários avisos "uncertain about mutation / dynamic-call". São esperados e não bloqueiam.

## Colocar na timeline

```json
{"type": "motion-graphic", "assetId": "<id>", "fromFrame": 0, "durationInFrames": <total>, "left": 0, "top": 290, "width": 1080, "height": 220}
```

Sem `trackId`: o ChatCut cria a faixa V2 por cima dos clipes. Com `top:290`, as linhas de base caem em y=352 e y=404, a posição da referência.

## Propriedades

```json
[
  {"key": "text", "label": "Texto", "type": "text", "defaultValue": "FRASE AQUI"},
  {"key": "breakAfterWord", "label": "Quebrar linha depois da palavra nº (0 = automático)", "type": "number", "defaultValue": 0, "min": 0, "max": 20, "step": 1},
  {"key": "maxLineWidth", "label": "Largura máxima da linha (px)", "type": "number", "defaultValue": 640, "min": 200, "max": 1000, "step": 10},
  {"key": "fontFamily", "label": "Fonte", "type": "font", "defaultValue": "TikTok Sans"},
  {"key": "fontSize", "label": "Tamanho da fonte", "type": "number", "defaultValue": 45, "min": 20, "max": 90, "step": 1},
  {"key": "lineHeight", "label": "Altura da linha (px)", "type": "number", "defaultValue": 52, "min": 20, "max": 120, "step": 1},
  {"key": "textColor", "label": "Cor do texto", "type": "color", "defaultValue": "#FFFFFF"},
  {"key": "outlineColor", "label": "Cor do contorno", "type": "color", "defaultValue": "#000000"},
  {"key": "boldWidth", "label": "Negrito (px)", "type": "number", "defaultValue": 1.1, "min": 0, "max": 4, "step": 0.1},
  {"key": "outlineWidth", "label": "Contorno (px)", "type": "number", "defaultValue": 2.9, "min": 0, "max": 8, "step": 0.1}
]
```

## Código

```jsx
const Component = ({ item }) => {
  const frame = useCurrentFrame();
  const props = item.props || {};
  const text = props.text;
  const breakAfterWord = props.breakAfterWord;
  const maxLineWidth = props.maxLineWidth;
  const fontFamily = props.fontFamily;
  const fontSize = props.fontSize;
  const lineHeight = props.lineHeight;
  const textColor = props.textColor;
  const outlineColor = props.outlineColor;
  const boldWidth = props.boldWidth;
  const outlineWidth = props.outlineWidth;

  const boxWidth = 1080;
  const boxHeight = 220;
  const firstBaseline = 62;
  const canvasRef = React.useRef(null);
  const fontState = React.useState(0);
  const fontTick = fontState[0];
  const setFontTick = fontState[1];
  const fontSpec = '400 ' + Number(fontSize) + 'px ' + fontFamily;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.ownerDocument || !canvas.ownerDocument.fonts) {
      return undefined;
    }
    let cancelled = false;
    canvas.ownerDocument.fonts.load(fontSpec).then(() => {
      if (!cancelled) {
        setFontTick((value) => value + 1);
      }
    }, () => {});
    return () => {
      cancelled = true;
    };
  }, [fontSpec]);

  const splitLines = (ctx) => {
    const raw = String(text);
    const newline = String.fromCharCode(10);
    if (raw.indexOf(newline) >= 0) {
      return raw.split(newline).map((part) => part.trim()).filter((part) => part.length > 0);
    }
    const words = raw.split(' ').filter((word) => word.length > 0);
    const manual = Math.round(Number(breakAfterWord));
    if (manual > 0 && manual < words.length) {
      return [words.slice(0, manual).join(' '), words.slice(manual).join(' ')];
    }
    const full = words.join(' ');
    const total = ctx.measureText(full).width;
    const limit = Number(maxLineWidth);
    if (total <= limit || words.length < 2) {
      return [full];
    }
    const count = Math.ceil(total / limit);
    const target = total / count;
    const lines = [];
    let current = '';
    words.forEach((word) => {
      if (current.length === 0) {
        current = word;
        return;
      }
      const candidate = current + ' ' + word;
      if (lines.length >= count - 1) {
        current = candidate;
        return;
      }
      const currentGap = Math.abs(ctx.measureText(current).width - target);
      const candidateGap = Math.abs(ctx.measureText(candidate).width - target);
      if (candidateGap <= currentGap) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });
    lines.push(current);
    return lines;
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, boxWidth, boxHeight);
    ctx.font = fontSpec;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const centerX = boxWidth / 2;
    const lines = splitLines(ctx);
    const bold = Number(boldWidth);
    const outline = Number(outlineWidth);
    const step = Number(lineHeight);

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = (bold + outline) * 2;
    lines.forEach((line, index) => {
      ctx.strokeText(line, centerX, firstBaseline + index * step);
    });

    ctx.strokeStyle = textColor;
    ctx.fillStyle = textColor;
    ctx.lineWidth = bold * 2;
    lines.forEach((line, index) => {
      const baseline = firstBaseline + index * step;
      if (bold > 0) {
        ctx.strokeText(line, centerX, baseline);
      }
      ctx.fillText(line, centerX, baseline);
    });
  }, [frame, fontTick, text, breakAfterWord, maxLineWidth, fontSpec, lineHeight, textColor, outlineColor, boldWidth, outlineWidth]);

  const rootStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
  };
  const fontLoaderStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    fontFamily: fontFamily,
    fontWeight: 400,
    fontSize: Number(fontSize),
    opacity: 0,
    whiteSpace: 'nowrap',
  };
  const canvasStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: boxWidth,
    height: boxHeight,
  };

  return (
    <div style={rootStyle}>
      <div style={fontLoaderStyle}>{text}</div>
      <canvas ref={canvasRef} width={boxWidth} height={boxHeight} style={canvasStyle} />
    </div>
  );
};
```

## Por que é assim

- **Canvas com dois traços.** O negrito do CapCut engrossa a letra por fora sem aumentar o espaço entre as letras. Um peso bold da fonte fica mais fino e mais espaçado; o usuário notou e rejeitou. Por isso o texto é desenhado com um traço preto largo, depois um traço branco fino e o preenchimento branco.
- **Negrito 1,1 e contorno 2,9.** O navegador desenha a TikTok Sans mais grossa que o ffmpeg. Com os valores medidos no ffmpeg (1,5 e 3) o usuário achou que a fonte estava diferente; estes são os que batem no ChatCut.
- **`fontFamily` sem aspas extras.** A propriedade já chega como `"TikTok Sans", "Noto Sans SC"`. Envolver em mais aspas faz o canvas ignorar a fonte e desenhar em 10 px.
- **Um campo de texto só.** O usuário pediu uma frase única com quebra automática, e não duas linhas separadas. `breakAfterWord` força o ponto da quebra quando a automática ficar ruim.
- **A exportação com este canvas ainda não foi testada.** Se o usuário exportar, peça para conferir o texto no arquivo final.
