# WORKLOG — satoshishrine-site

Append-only. One file. Read the tail before starting work; the SessionStart
hook prints it for you. Never fork this into WORKLOG_<date>.md — a log that
forks is a log nobody reads.

- ran `cd /c/Users/Forre/amazon grep -n "topnav\|determination.html\|for-counsel" build_shrine_page.py | head` — Find the nav links to strip for standalone
- ran `cd /c/Users/Forre/amazon STANDALONE="/c/Users/Forre/satoshishrine-site" mkdir -p "$STANDALONE" # regenerate fresh data + page into a temp, then transf…` — Build the standalone public crypto site
- ran `cd /c/Users/Forre/amazon S="C:/Users/Forre/AppData/Local/Temp/claude/C--Users-Forre/92b9de6e-2fe6-4859-80b8-b006ef6a43c1/scratchpad" STANDALONE="/c/Us…` — Regenerate the crypto page into scratchpad
- ran `S="C:/Users/Forre/AppData/Local/Temp/claude/C--Users-Forre/92b9de6e-2fe6-4859-80b8-b006ef6a43c1/scratchpad" STANDALONE="/c/Users/Forre/satoshishrine-s…` — Build the clean standalone site
- ran `cd /c/Users/Forre/satoshishrine-site timeout 300 npx vercel link --yes --project satoshishrine 2>&1 | tail -3 cat .vercel/project.json 2>/dev/null | h…` — Create/link the satoshishrine Vercel project
- ran `cd /c/Users/Forre/satoshishrine-site timeout 600 npx vercel deploy --prod --yes 2>&1 | grep -iE "Production|Inspect|error" | head -3` — Deploy the standalone crypto site to production
- ran `cd /c/Users/Forre/satoshishrine-site timeout 180 npx vercel domains add satoshishrine.com satoshishrine 2>&1 | tail -6 echo "=== also add www ===" tim…` — Attach satoshishrine.com to the project
- ran `cd /c/Users/Forre/satoshishrine-site timeout 180 npx vercel alias set satoshishrine-pz31zjp4b-drdyors-projects.vercel.app satoshishrine.com 2>&1 | tai…` — Alias the domain and inspect config
- ran `sleep 8 echo "=== https://satoshishrine.com ===" curl -s -o /dev/null -w "HTTP %{http_code} | cert-CN via SSL | bytes %{size_download} | redirect: %{r…` — Verify the live satoshishrine.com deployment and certificate
- ran `echo "=== apex vs www, from here ===" for h in satoshishrine.com www.satoshishrine.com; do   echo "$h -> $(curl -s -o /dev/null -w 'HTTP %{http_code}'…` — Check apex, www, and current resolved IP
- ran `Clear-DnsClientCache try { $r = Resolve-DnsName satoshishrine.com -Type A -Server 1.1.1.1 -ErrorAction Stop | Where-Object IPAddress | Select-Object -…` — Flush local DNS cache and compare resolvers
