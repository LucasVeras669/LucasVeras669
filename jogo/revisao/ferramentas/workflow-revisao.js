export const meta = {
  name: 'revisao-fluxo-brutal',
  description: 'Revisa o jogo Fluxo Brutal em 5 frentes, verifica bugs adversarialmente e monta plano de implementação',
  phases: [
    { title: 'Review', detail: '5 revisores: bugs de interação, câmera, fluidez, visual, free flow' },
    { title: 'Verify', detail: 'verificação adversarial dos bugs de cada revisor' },
    { title: 'Plan', detail: 'plano de implementação em pacotes sequenciais' },
  ],
}

const QA = '/tmp/claude-0/-home-user-LucasVeras669/df342a4f-9004-59b5-89e6-2b9773635a0a/scratchpad/qa'
const CONTEXT = `
CONTEXTO DO PROJETO
- Jogo: "Fluxo Brutal", jogo de luta 1x1 mobile em um único arquivo: /home/user/LucasVeras669/jogo/index.html (~1000 linhas, HTML+CSS+JS inline, canvas 2D, sem libs externas além de Google Fonts).
- Boxeador vs Taekwondo. Personagens procedurais (esqueleto de 10 ângulos + molas amortecidas, desenhados com linhas/círculos). NÃO usar sprites externos.
- Mundo 2.5D: projeção P(x,y,z) com perspectiva, arena x∈[-230,230], z∈[170,285]; canvas de baixa resolução (H=200 em paisagem) escalado com image-rendering pixelated.
- Mecânicas existentes (manter): 7 botões (3 golpes básicos nomeados por estilo b1/b2/b3, FLUXO=bAtk, ESQUIVA=bDod, CONTRA=bCnt, ESPECIAL=bFin) + joystick virtual esquerdo; teclado J/K/L/I/1/2/3.
  Ritmo PERFEITO/CEDO, níveis de FLUXO (0-3), flanco, esquiva perfeita, finta (raio branco), guarda e quebra de guarda, juggle aéreo, ESPECIAL/SUPER em sequência, cenas de contra-ataque cinematográficas (SCENES/runStep/cseq, SHOTS de câmera, impact frame, speed lines, letterbox com nome), câmera com enquadramento automático (bbox + zFit + panX/panY).
- Funções-chave: skel(), drawFighter(), drawBG(), drawFG(), render(), update(), updPlayer(), updEnemy(), phys(), applyHit(), dashTo(), startMove(), doCounter(), runStep(), pickScene(), doDodge(), doFinisher(), tryAct(), eStart(), eAttack().
- Textos de UI em português do Brasil.
- Pedido do usuário agora: "faça uma revisão no jogo, e melhore ainda mais: 1) Estilo, profundidade e detalhes do cenário e personagens 2) Fluidez de movimentos 3) Correção de bugs de movimentos, interação, câmera 4) Dinamismo ainda mais do free flow combat, deixe ainda mais imersivo". Personagens devem continuar procedurais (como estão).

FERRAMENTAS DE TESTE (já prontas)
- Checagem de sintaxe: bash ${QA}/check.sh
- Jogar headless com Playwright: node ${QA}/harness.js <box|tkd> <segundos> <prefixo_saida> [largura altura] [mix|counter|flow|idle]
  Ex.: node ${QA}/harness.js box 15 ${QA}/rev_box 844 390 mix  -> imprime JSON (erros, FPS aprox., HUD) e salva PNGs <prefixo>_N.png que você pode abrir com a ferramenta Read para ver.
- Para instrumentar/experimentar, COPIE o arquivo para um diretório seu em ${QA}/<seu_nome>/ e edite a cópia (pode expor estado em window.__FB para inspecionar via page.evaluate). NUNCA edite /home/user/LucasVeras669/jogo/index.html nesta etapa.
`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id curto único, ex: CAM-3' },
          kind: { type: 'string', enum: ['bug', 'improvement'] },
          title: { type: 'string' },
          evidence: { type: 'string', description: 'linhas/funções do código e/ou observação reproduzida (cenário concreto)' },
          proposal: { type: 'string', description: 'mudança concreta proposta, específica o bastante para outro agente implementar' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
        },
        required: ['id', 'kind', 'title', 'evidence', 'proposal', 'impact', 'effort'],
      },
    },
  },
  required: ['findings'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          real: { type: 'boolean' },
          reason: { type: 'string' },
          refinedProposal: { type: 'string', description: 'correção mais precisa, se aplicável' },
        },
        required: ['id', 'real', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

const PLAN = {
  type: 'object',
  properties: {
    packages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          goal: { type: 'string' },
          items: { type: 'array', items: { type: 'string' }, description: 'cada item: id(s) + instrução concreta de implementação' },
          acceptance: { type: 'array', items: { type: 'string' } },
          risks: { type: 'string' },
        },
        required: ['name', 'goal', 'items', 'acceptance'],
      },
    },
    dropped: { type: 'array', items: { type: 'string' }, description: 'itens descartados com motivo' },
  },
  required: ['packages', 'dropped'],
}

const LENSES = [
  { key: 'interacao', prompt: `Você é revisor de BUGS DE MOVIMENTO E INTERAÇÃO. Leia o código inteiro com atenção e jogue com o harness (box e tkd, modos mix, counter e flow). Procure bugs concretos: estados presos (jogador/rival travado), transições inválidas da máquina de estados (updPlayer/updEnemy), buffers de input (tryAct, queued, early) que se perdem ou disparam errado, janelas de ritmo, contra-ataque (doCounter/runStep/cseq/inScene) que trava ou deixa inScene=true, ESPECIAL (fseq) interrompido, esquiva/esquiva perfeita, hit detection (alcance x/z, golpes que erram sem motivo ou acertam de longe), rival atravessando o jogador, separação, clamps da arena, juggle aéreo (air/airHits), guarda/quebra, finta, fim de round/partida (roundOver, win, setTimeout), timers (comboT, hitstop, slowT, timeScale) e qualquer exceção no console. Para cada bug descreva o cenário concreto de reprodução. Inclua também pequenas melhorias de interação se forem claras. Máx. 14 achados, os mais importantes.` },
  { key: 'camera', prompt: `Você é revisor de CÂMERA. Estude render() (camX, zoom/zoomT/zKick, foco fx/fy, panX/panY, zFit, SHOTS/camCut, tilt, letterbox lbox, shake, cine) e jogue com o harness em paisagem 844x390 e retrato 390x844, modos mix/counter/flow, olhando os screenshots. Procure: lutadores saindo do quadro (no ar, nas extremidades da arena, durante cenas de contra/especial), saltos/tremidas de câmera, cortes estranhos, zoom brigando com o enquadramento, letterbox/HUD/botões cobrindo a ação, bordas do cenário aparecendo (fundo vazio ao dar zoom out < 1 ou panX/panY), pilares do primeiro plano escondendo os lutadores, tilt exagerado, câmera durante KO e troca de round, comportamento em retrato. Proponha correções concretas e melhorias cinematográficas de câmera (ex.: leve rotação/órbita simulada, lead na direção do movimento, suavização crítica-amortecida). Máx. 12 achados.` },
  { key: 'fluidez', prompt: `Você é revisor de FLUIDEZ DE MOVIMENTO (animação). Estude as poses (G, HURT_*, DUCK, etc.), as molas (setPose, phys: k, zt, KJ/ZJ, subpassos), walkPose/idlePose, as keys dos golpes (mk), spin/tw/turn, dash/dodge/getup/down/ko, e jogue com o harness olhando sequências de screenshots. Encontre pontos rígidos ou que "teleportam": pés deslizando (passo não acompanha a velocidade), viradas, transição ataque->guarda, aterrissagem sem amortecimento, poses que estouram por mola instável, rival com movimento robótico na aproximação, interpolações lineares, falta de antecipação/follow-through, giro de tronco estranho, membros atravessando o corpo, golpes que não leem bem. Proponha mudanças concretas (valores de mola, novas keys/poses, IK simples de pé plantado, peso/bob do quadril, overlap de cabeça/braços, motion smear, squash leve, transições por estado). Máx. 12 achados.` },
  { key: 'visual', prompt: `Você é revisor de DIREÇÃO DE ARTE (estilo, profundidade e detalhes do cenário e personagens) para pixel art "voltada ao realismo com profundidade, misturando 2D, 2.5D e 3D". Estude drawBG/drawFG/drawFighter/paletas/partículas/vinheta e veja screenshots do harness. Proponha melhorias concretas e implementáveis em canvas 2D procedural, mantendo bom desempenho no celular: mais camadas de profundidade e paralaxe, iluminação (luz das lâmpadas nos personagens, rim light, sombras de contato e projetadas), névoa/poeira volumétrica, chão com reflexo/umidade/manchas, detalhes únicos de um ringue clandestino no subsolo (grades, cabos, ventiladores, poças, cartazes, plateia mais viva), color grading, e para os personagens: anatomia/sombreamento por plano, dobras de roupa, cabelo, detalhes das luvas/dobok/faixa, contorno consistente, pixel snapping. Cada proposta deve dizer onde no código e como desenhar. Também aponte bugs visuais (z-order, objetos sobrepostos, coisas cortadas). Máx. 14 achados.` },
  { key: 'freeflow', prompt: `Você é designer de COMBATE FREE FLOW (estilo Batman Arkham / Sleeping Dogs / Sifu) e imersão. Estude todo o sistema de combate (ritmo, fluxo, flanco, contra em cena, esquiva perfeita, especiais, IA do rival) e jogue com o harness. Proponha as melhorias de maior impacto para deixar o free flow MAIS DINÂMICO E IMERSIVO, mantendo os mesmos 7 botões + joystick e o 1x1 boxe vs taekwondo: ex. interação com cenário (empurrar o rival contra pilares/grade e quicar, wall-splat), choque de golpes simultâneos (clash), momentum/velocidade crescente, câmera que dança com o combo, plateia e som reagindo ao fluxo, batida rítmica/visual cue para o PERFEITO, variações automáticas de travessia no FLUXO (deslizar, saltar por cima, contornar em profundidade), finalizações contextuais (rival no chão, rival na grade, rival no ar), IA do rival que se adapta e que também usa free flow, golpes de follow-up no chão, haptics. Seja específico (estados novos, funções a alterar, números). Aponte também falhas atuais do free flow (ex.: input que não responde, fluxo que zera de forma frustrante). Máx. 14 achados.` },
]

phase('Review')
const reviewed = await pipeline(
  LENSES,
  (lens) => agent(`${CONTEXT}\n\nTAREFA\n${lens.prompt}\n\nRetorne achados priorizados, com ids prefixados por ${lens.key.toUpperCase().slice(0,4)}-. Evidência deve citar funções/linhas reais do arquivo atual.`, { label: `review:${lens.key}`, phase: 'Review', schema: FINDINGS }),
  async (res, lens) => {
    if (!res) return null
    const bugs = res.findings.filter(f => f.kind === 'bug')
    if (!bugs.length) return { lens: lens.key, findings: res.findings, verdicts: [] }
    const v = await agent(`${CONTEXT}\n\nTAREFA: você é um VERIFICADOR CÉTICO. Abaixo estão bugs relatados por outro revisor (frente: ${lens.key}). Para CADA um, tente REFUTAR: leia o código atual e, quando possível, reproduza com o harness ou com uma cópia instrumentada. Marque real=true só se você conseguir traçar um caminho concreto (inputs/estado -> comportamento errado) no código atual. Se a correção proposta estiver errada ou incompleta, dê refinedProposal.\n\nBUGS:\n${JSON.stringify(bugs, null, 1)}`, { label: `verify:${lens.key}`, phase: 'Verify', schema: VERDICTS })
    return { lens: lens.key, findings: res.findings, verdicts: v ? v.verdicts : [] }
  }
)

const all = []
for (const r of reviewed.filter(Boolean)) {
  const vmap = {}
  for (const v of r.verdicts) vmap[v.id] = v
  for (const f of r.findings) {
    if (f.kind === 'bug') {
      const v = vmap[f.id]
      if (v && !v.real) { all.push({ ...f, lens: r.lens, status: 'refutado', verifier: v.reason }); continue }
      all.push({ ...f, lens: r.lens, status: v ? 'confirmado' : 'nao-verificado', verifier: v ? v.reason : '', proposal: (v && v.refinedProposal) ? v.refinedProposal : f.proposal })
    } else all.push({ ...f, lens: r.lens, status: 'melhoria' })
  }
}
const keep = all.filter(f => f.status !== 'refutado')
log(`${all.length} achados; ${all.length - keep.length} bugs refutados; ${keep.length} seguem para o plano`)

phase('Plan')
const plan = await agent(`${CONTEXT}\n\nTAREFA: você é o líder técnico. Abaixo estão os achados aprovados (bugs confirmados + melhorias) das 5 frentes. Monte um PLANO DE IMPLEMENTAÇÃO em 5 a 6 pacotes que serão executados EM SEQUÊNCIA por agentes diferentes no MESMO arquivo (um de cada vez). Regras:\n- Primeiro pacote: correções de bugs de interação/movimento; depois câmera; depois fluidez; depois visual (cenário e personagens); depois free flow/imersão; por último polimento/desempenho se necessário. Ajuste se houver dependências.\n- Deduplique achados sobrepostos entre frentes e resolva conflitos (ex.: duas propostas diferentes para o mesmo sistema).\n- Escolha as melhorias de maior impacto; seja ambicioso mas viável (cada pacote deve caber no trabalho de um agente). Descarte o resto em 'dropped' com motivo.\n- Cada item deve ser uma instrução concreta (o quê, onde, valores). Inclua critérios de aceitação testáveis com o harness.\n- Preserve: 7 botões, controles, personagens procedurais, textos PT-BR, arquivo único, 60 FPS em celular.\n\nACHADOS:\n${JSON.stringify(keep, null, 1)}`, { label: 'plan', phase: 'Plan', schema: PLAN })

return { counts: { total: all.length, refuted: all.length - keep.length }, refuted: all.filter(f => f.status === 'refutado').map(f => ({ id: f.id, title: f.title, why: f.verifier })), findings: keep, plan }
