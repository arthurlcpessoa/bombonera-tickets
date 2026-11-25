# Fase 4: visão do assento

> Prompt para o Claude Code. Leia antes o `CLAUDE.md`, o `docs/ARQUITETURA.md` e o código de
> `src/features/seating/`, `src/features/stadium/components/CameraRig.tsx` e `src/store/`.
> Explique cada etapa de forma didática enquanto implementa.

## Objetivo

O recurso principal do projeto: o torcedor clica numa cadeira e **vê o campo exatamente como verá
sentado nela**, em 3D, podendo olhar em volta. Também pode comparar cadeiras vizinhas sem sair dessa
visão e compartilhar um link que abre direto nela.

## Ponto de partida

- Toda `Seat` já tem `eye` (ponto dos olhos, `SEAT_LAYOUT.eyeHeight` = 1,15 m acima do assento),
  `yaw` (para onde a cadeira olha), `row`, `number`, `a`, `b` e `status`. **Use esses dados**: não
  recalcule posição.
- `findSeat(id, model)` em `data/seats.ts`, e `getSectorSeats` em `lib/seatLayout.ts`.
- `CameraRig` reage aos stores via `subscribe` (presets e voo até o setor). Siga o mesmo padrão.
- O `StadiumModel` já tem `<Bvh firstHitOnly>`: raycasts contra o estádio são rápidos.
- `SeatSelectionSummary` já tem o botão desabilitado "Ver visão do assento" (Fase 4).

## 0. Aquecimento (commit separado, antes da fase)

1. **Créditos legíveis:** o texto do rodapé some sobre a arquibancada amarela. Dê a ele um fundo
   sutil (ex.: `glass-subtle`, em pílula), sem ocupar mais altura no celular.
2. **Atalho para o visitante:** o setor Visitante (`upper-8`) não aparece na visão geral. Adicione
   uma forma clara de chegar até ele, por exemplo um item "Visitante" na legenda de preços que,
   ao ser clicado, seleciona o setor (e a câmera voa até ele). Explique a escolha.

## 1. Estado: `src/store/useSeatViewStore.ts`

- `viewingSeatId: string | null`, `requestId`, ações `enterSeatView(id)`, `exitSeatView()` e
  `moveSeatView(direction)` (`'left' | 'right' | 'front' | 'back'`).
- Entrar na visão **não seleciona** a cadeira: é possível espiar cadeiras vendidas e livres.
- Funções puras de navegação em `seating/lib/seatNavigation.ts`: cadeira vizinha na mesma fila e
  na fila da frente ou de trás (escolhendo a de `a` mais próximo, já que as filas têm tamanhos
  diferentes nas curvas). Não sai do setor. Nas pontas, não faz nada.

## 2. Câmera em primeira pessoa (`CameraRig`)

- Ao entrar: voo animado da posição atual até `eye`, terminando olhando para o campo. Defina o alvo
  inicial em `seating/lib/seatView.ts` (função pura): a direção da cadeira (`yaw`) inclinada para
  baixo até encontrar o gramado, com o ponto mantido dentro do retângulo do campo. Explique a conta.
- Depois do voo, o modo é **"girar a cabeça"**: a câmera fica parada nos olhos e só gira.
  - Com `CameraControls`, deixe o alvo a poucos centímetros à frente dos olhos, bloqueie dolly e
    truck (mover) e limite azimute (±~110° em torno da frente da cadeira) e polar (não olhar para o
    céu nem para os próprios pés).
  - Scroll ou pinça = **zoom de binóculo** (muda o `zoom`/FOV da câmera, de 1× a ~3×), e não
    aproximação da câmera.
  - Ajuste `near` (~0,05 m) e `far` da câmera no modo assento, porque a fila da frente está a menos
    de 1 m. Restaure os valores ao sair. Explique o que são os planos near e far e por que a
    precisão de profundidade depende da razão entre eles.
- Ao sair (`Esc`, botão ou trocar de setor): restaure limites, near/far, FOV e controles, e volte
  voando ao enquadramento do setor da cadeira (`flyToSector`).
- Trocar de cadeira com `moveSeatView` faz um voo curto entre os pontos dos olhos, **mantendo a
  direção do olhar** quando fizer sentido.
- Celular: arrastar para olhar em volta e pinça para o binóculo. Teste em 390 px, retrato e paisagem.

## 3. Cena no modo assento

- Esconda as superfícies dos setores e as cadeiras instanciadas: a visão deve ser "limpa", como na vida
  real. Uma chave "Mostrar cadeiras à venda" no HUD pode reexibir as do setor atual.
- O resto da interface (legenda, botões de visão, painel do setor) sai de cena com uma transição
  suave e volta ao sair.

## 4. HUD da visão do assento (`components/ui/SeatViewHud.tsx`)

- Cartão com: setor (com selo de visitante, se for o caso), fila, cadeira, preço e status.
- **Métricas da visão** (`seating/lib/seatView.ts`, puras e testadas):
  - distância até o meio-campo e até o gol mais próximo (m);
  - altura em relação ao gramado (m);
  - ângulo de visão: quantos graus de largura o campo ocupa a partir daquela cadeira.
- **Visibilidade do campo:** lance ~60 raios dos olhos até pontos espalhados pelo gramado e conte
  quantos são bloqueados pelo estádio, usando o BVH existente. Mostre "Visão livre", "Visão
  parcialmente obstruída (x%)" etc. Calcule só ao entrar na visão ou trocar de cadeira, nunca por
  quadro. Explique a técnica. Nos palcos, sob a laje, isso deve refletir a obstrução real.
- Ações: "Escolher esta cadeira" / "Remover da seleção" (respeitando vendida e o limite de 6),
  setas para a cadeira vizinha (← → mesma fila, ↑ ↓ filas) e "Sair da visão".
- Teclado: setas navegam, `Enter` escolhe, `Esc` sai, `+`/`-` controlam o binóculo. Mostre uma dica
  discreta com os atalhos. Respeite `prefers-reduced-motion`: voos instantâneos.

## 5. Pontos de entrada

- **Resumo da seleção:** um botão de "olho" em cada cadeira escolhida. O botão geral "Ver visão do
  assento" abre a última cadeira escolhida.
- **3D:** duplo clique numa cadeira (com a regra clique × arrasto). Mostre a dica no tooltip da cadeira.
- **Mini-mapa:** tecla `V` na cadeira focada e um botão no painel para a cadeira em destaque.

## 6. Link compartilhável

- Na visão do assento, a URL vira `?assento=upper-3:F12-C07` (com `history.replaceState`, sem
  recarregar). Ao abrir um link assim, o site carrega, seleciona o setor e entra na visão daquela
  cadeira. Id inválido: ignora sem quebrar e mostra um aviso curto.
- Botão "Copiar link" no HUD (`navigator.clipboard`, com confirmação "Link copiado").
- Mantenha `?debug` funcionando junto.

## Critérios de aceite

- [ ] A visão em primeira pessoa fica na altura dos olhos e **parece real**: a fila da frente aparece
      embaixo, o campo inteiro é visível de cadeiras sem obstrução, e a laje aparece nos palcos.
      Mande prints de 4 cadeiras: Inferior fila 1, Superior última fila, canto do U e Palcos.
- [ ] Olhar em volta funciona com mouse e toque. A câmera não "anda", só gira. O binóculo funciona.
- [ ] Navegar entre cadeiras vizinhas funciona pelos botões e pelo teclado.
- [ ] Sair restaura tudo: limites da câmera, near/far, interface, setores e cadeiras.
- [ ] Métricas e visibilidade aparecem e fazem sentido (fila 1 da inferior: perto e baixo; superior: longe e alto).
- [ ] O link `?assento=...` abre direto na visão. Id inválido não quebra a página.
- [ ] Testes novos (Vitest) para `seatNavigation.ts` e as partes puras de `seatView.ts`.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` e `npm run build` passam. Código formatado.
- [ ] `docs/ARQUITETURA.md` (nova seção "Como a visão do assento funciona"), README (status e um GIF
      ou print da visão do assento) e `CLAUDE.md` (roadmap) atualizados.

## Ordem sugerida

0. Aquecimento (créditos + atalho do visitante), num commit próprio.
1. `useSeatViewStore` + `seatView.ts` (alvo inicial) + entrada e saída da câmera, ainda sem HUD.
   Mande prints das 4 cadeiras de teste.
2. Modo "girar a cabeça", binóculo, near/far.
3. HUD com dados da cadeira, navegação entre vizinhas e teclado.
4. Métricas e visibilidade por raios.
5. Pontos de entrada (resumo, duplo clique, mini-mapa) e esconder/mostrar a interface.
6. Link compartilhável.
7. Mobile, `prefers-reduced-motion`, documentação e checagens.
8. Trabalhe na branch `fase-4-visao-do-assento`, com commits por etapa. No fim, faça push e abra um
   Pull Request para a `main` com uma descrição completa e prints. Se o `gh` não estiver instalado,
   me passe o link de criação do PR. **Pergunte antes de fazer push.**

Ao final, resuma o que foi feito, o que aprender com cada parte e como testar.
