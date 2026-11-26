# Bombonera Tickets

Venda de ingressos para jogos do Boca Juniors com **escolha de assento em 3D** na La Bombonera.
O torcedor navega pelo estádio em 3D, escolhe setor e cadeira e vê **exatamente a visão que terá do campo** antes de comprar.

> Projeto de portfólio, sem vínculo oficial com o Club Atlético Boca Juniors.

## Status

| Fase | Descrição                                                     | Status       |
| ---- | ------------------------------------------------------------- | ------------ |
| 1    | Setup do projeto + estádio 3D navegável                       | ✅ Concluída |
| 2    | Setores interativos (hover, preço, câmera voando até o setor) | ✅ Concluída |
| 3    | Cadeiras geradas por código (InstancedMesh) e seleção         | ✅ Concluída |
| 4    | Visão do assento em primeira pessoa                           | ✅ Concluída |
| 5    | Back-end: API, banco, reserva temporária, checkout (sandbox)  | ⏳ Próxima   |
| 6    | Acabamento: mobile, desempenho, deploy                        | —            |

## Stack

- **TypeScript** em todo o projeto
- **React 19 + Vite**: interface e build
- **Three.js + React Three Fiber + drei**: renderização 3D
- **Zustand**: estado global (visão ativa, setor e cadeiras escolhidas, visão do assento)
- **Tailwind CSS 4**: estilo da interface sobre o canvas
- **glTF Transform + meshoptimizer + sharp**: pipeline de otimização do modelo 3D
- **three-mesh-bvh**: raycasting rápido (script de medição e bloqueio do ponteiro pelo estádio)
- **leva**: painel de calibração do modo `?debug` (carregado sob demanda)
- **Vitest**: testes automatizados das funções puras
- **oxlint + Prettier**: qualidade e formatação de código

## Como rodar

Pré-requisito: **Node.js 22.18+** (os scripts `stands:*` executam TypeScript direto no Node).

```bash
npm install
npm run dev
```

Abra <http://localhost:5173>. Para o painel de calibração dos setores, abra <http://localhost:5173/?debug>.

| Script                     | O que faz                                                   |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Servidor de desenvolvimento com recarregamento automático   |
| `npm run build`            | Checagem de tipos + build de produção em `apps/web/dist`    |
| `npm run preview`          | Serve o build de produção localmente                        |
| `npm run lint`             | Lint com oxlint                                             |
| `npm run typecheck`        | Checagem de tipos do TypeScript                             |
| `npm test`                 | Testes automatizados (Vitest) das funções de geometria      |
| `npm run format`           | Formata todo o código com Prettier                          |
| `npm run model:optimize`   | Regera `bombonera.glb` a partir do modelo bruto (veja docs) |
| `npm run stands:probe`     | Mede o modelo 3D (perfis das arquibancadas; veja docs)      |
| `npm run stands:calibrate` | Regera a tabela de correção dos setores                     |

### VS Code

Ao abrir a pasta, o VS Code sugere as extensões recomendadas (Prettier, oxc, Tailwind, glTF Tools...).
Formatação e correções de lint rodam ao salvar. Em **Run and Debug**, use _"Depurar no Chrome"_ para colocar breakpoints direto no código React.

## Como funciona

1. **Estádio 3D:** o modelo `.glb` comprimido é carregado no `<Canvas>` do React Three Fiber.
2. **Setores:** o modelo não tem setores separados, então eles são gerados por código. Um caminho em "U"
   descreve a planta das bandejas, um perfil descreve a inclinação de cada uma, e uma tabela medida
   no próprio modelo corrige as diferenças. Cada setor vira uma superfície translúcida colorida pela
   faixa de preço. Passe o mouse para ver preço e disponibilidade; clique para a câmera voar até ele.
3. **Cadeiras:** no setor escolhido aparecem as cadeiras (~36 mil no estádio, geradas sobre a mesma
   superfície do setor), com fila, número e status. Escolha até 6 no 3D ou no mini-mapa (que também
   funciona só com o teclado) e veja o resumo com o total.
4. **Visão do assento:** "sente" em qualquer cadeira e veja o campo em primeira pessoa, na altura dos
   olhos: olhe em volta (arrastar), use o binóculo (scroll ou pinça), compare as vizinhas pelas setas e
   veja distância, altura, ângulo do campo e quanto dele fica escondido por alguma estrutura (calculado
   com raios). O link `?assento=...` abre direto naquela cadeira.

Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Estrutura

```
bombonera-tickets/
├── apps/
│   └── web/                     # Front-end (React + Three.js)
│       ├── public/models/       # bombonera.glb otimizado (6,8 MB)
│       └── src/
│           ├── components/ui/   # Interface HTML sobre o 3D (header, legenda, tooltip, painel)
│           ├── config/          # Constantes do estádio (caminho em U, perfis, câmera)
│           ├── features/
│           │   ├── stadium/     # Cena 3D: canvas, modelo, câmera, ambiente
│           │   ├── seating/     # Setores: geometria (lib), dados (data) e malhas 3D (components)
│           │   └── debug/       # Painel de calibração (só com ?debug)
│           └── store/           # Estado global (Zustand)
├── assets-src/                  # Modelo bruto do Sketchfab (fora do Git)
├── docs/                        # Arquitetura, pipeline do modelo 3D e prompts das fases
└── scripts/                     # optimize-model.mjs, probe-stands.mjs
```

Mais detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e [`docs/MODELO-3D.md`](docs/MODELO-3D.md).

## Créditos

Este trabalho usa o modelo [“La Bombonera (Boca Juniors)”](https://sketchfab.com/3d-models/la-bombonera-boca-juniors-82204c5963b84ac593c26127ac36fbfa)
de [A1905](https://sketchfab.com/al1905), licenciado sob [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
O modelo foi recentralizado e comprimido para uso na web.

O código-fonte deste repositório está sob a licença [MIT](LICENSE). A licença MIT não se aplica ao modelo 3D nem às marcas do clube.
