#!/bin/bash
# Verifica a sintaxe do <script> do jogo
python3 - <<'PY'
import re,subprocess,sys
s=open('/home/user/LucasVeras669/jogo/index.html').read()
m=re.search(r'<script>(.*)</script>',s,re.S)
open('/tmp/claude-0/-home-user-LucasVeras669/df342a4f-9004-59b5-89e6-2b9773635a0a/scratchpad/qa/_game.js','w').write(m.group(1))
r=subprocess.run(['node','--check','/tmp/claude-0/-home-user-LucasVeras669/df342a4f-9004-59b5-89e6-2b9773635a0a/scratchpad/qa/_game.js'],capture_output=True,text=True)
print('SYNTAX OK' if r.returncode==0 else 'SYNTAX ERROR\n'+r.stderr)
PY
