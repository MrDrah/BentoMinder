cd /c/Projects/BentoMinder/docs/ba/_scratch/research-i
for p in "$@"; do
  id=$(echo $p | tr '/' '_')
  [ -s kik/sets/$id.html ] && continue
  curl -sL -A "Mozilla/5.0 (research; BentoMinder library)" --max-time 40 -o kik/sets/$id.html "https://www.kikkoman.co.jp/homecook/lunch/$p.html"
  echo "$p $(wc -c < kik/sets/$id.html)"
  sleep 3
done
