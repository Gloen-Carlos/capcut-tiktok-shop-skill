#!/usr/bin/env bash
# Analisa uma pasta de clipes de produto.
# Uso: analisar.sh <pasta-dos-clipes> <pasta-de-saida>
#
# Imprime, por clipe: rótulo (c1, c2...), total de frames e os frames onde há corte.
# Gera na pasta de saída:
#   visao-geral.jpg  uma linha por clipe (1 quadro por segundo), para agrupar por produto
#   cN.jpg           folha do clipe N, um quadro a cada 6 frames, com o número do frame
#
# Precisa de ffmpeg e ffprobe no PATH. A fonte do carimbo é a Arial do sistema: a do Windows, ou
# a do macOS quando roda no macOS. Para usar outra, aponte $ANALISAR_FONT para um .ttf; num
# caminho com ":" (Windows), escape o ":" como o ffmpeg exige — num caminho unix não precisa.

set -u
IN="${1:?informe a pasta dos clipes}"
OUT="${2:?informe a pasta de saida}"
mkdir -p "$OUT"
if [ -n "${ANALISAR_FONT:-}" ]; then
  FONT="$ANALISAR_FONT"
elif [ "$(uname -s)" = "Darwin" ]; then
  FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
  [ -f "$FONT" ] || FONT="/Library/Fonts/Arial.ttf"
  [ -f "$FONT" ] || FONT="/System/Library/Fonts/Helvetica.ttc"
else
  FONT="C\:/Windows/Fonts/arial.ttf"
fi
# Sem a fonte o ffmpeg cai em outra e o carimbo sai diferente do esperado, sem reclamar; o aviso
# é para não descobrir isso olhando as folhas. O teste tira a barra invertida que o ffmpeg exige
# antes do ":" para olhar o caminho de verdade.
if [ ! -f "$(printf '%s' "$FONT" | sed 's/\\:/:/g')" ]; then
  echo "Aviso: fonte não encontrada ($FONT). Aponte \$ANALISAR_FONT para um .ttf." >&2
fi
LABEL="fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.7:x=6:y=6"

rows=()
i=1
for f in "$IN"/*.mp4; do
  [ -e "$f" ] || continue
  n=$(ffprobe -v error -select_streams v -show_entries stream=nb_frames -of csv=p=0 "$f")
  rate=$(ffprobe -v error -select_streams v -show_entries stream=r_frame_rate -of csv=p=0 "$f")
  fps=$(awk -F/ '{ if ($2 > 0) printf "%.3f", $1 / $2; else print $1 }' <<<"$rate")
  cuts=$(ffmpeg -hide_banner -i "$f" -vf "select='gt(scene,0.12)',showinfo" -an -f null - 2>&1 \
    | grep -o "pts_time:[0-9.]*" | awk -F: -v r="$fps" '{ printf "%d ", $2 * r + 0.5 }')
  echo "c$i | $n frames | $fps fps | cortes: ${cuts:-nenhum}| $(basename "$f")"

  lines=$(( (n / 6 + 10) / 10 ))
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "select='not(mod(n,6))',setpts=N/TB,scale=270:480,drawtext=fontfile='$FONT':text='f%{eif\:n*6\:d}':$LABEL,tile=10x$lines" \
    -frames:v 1 -fps_mode vfr -q:v 3 "$OUT/c$i.jpg" 2>&1 | grep -v Fontconfig

  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "fps=1,scale=180:320,drawtext=fontfile='$FONT':text='c$i':$LABEL,tile=10x1" \
    -frames:v 1 -q:v 4 "$OUT/_linha$i.jpg" 2>&1 | grep -v Fontconfig
  rows+=(-i "$OUT/_linha$i.jpg")
  i=$((i + 1))
done

count=$((i - 1))
if [ "$count" -eq 0 ]; then
  echo "Nenhum .mp4 encontrado em $IN" >&2
  exit 1
elif [ "$count" -eq 1 ]; then
  cp "$OUT/_linha1.jpg" "$OUT/visao-geral.jpg"
else
  ffmpeg -hide_banner -loglevel error -y "${rows[@]}" \
    -filter_complex "vstack=inputs=$count" -q:v 4 "$OUT/visao-geral.jpg"
fi
rm -f "$OUT"/_linha*.jpg
echo "Folhas em: $OUT"
