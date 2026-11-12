cd /c/Projects/BentoMinder/docs/ba/_scratch/research-i
for id in $(sed -n "$1,$2p" kik/ids.txt); do
  [ -s kik/rec/$id.html ] && continue
  curl -sL -A "Mozilla/5.0 (research; BentoMinder library)" --max-time 40 -o kik/rec/$id.html "https://www.kikkoman.co.jp/homecook/search/recipe/$id/"
  echo -n "$id $(wc -c < kik/rec/$id.html);"
  sleep 3
done
