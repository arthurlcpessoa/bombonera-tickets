# Bombonera Tickets

Venda de ingressos para jogos do Boca Juniors com **escolha de assento em 3D** na La Bombonera.
O torcedor navega pelo estádio em 3D, escolhe setor e cadeira e vê **exatamente a visão que terá do campo** antes de comprar.

> Projeto de portfólio, sem vínculo oficial com o Club Atlético Boca Juniors.

## Status

| Fase | Descrição                                                     | Status       |
| ---- | ------------------------------------------------------------- | ------------ |
| 1    | Setup do projeto + estádio 3D navegável                       | ✅ Concluída |
| 2    | Setores interativos (hover, preço, câmera voando até o setor) | ⏳ Próxima   |
| 3    | Cadeiras geradas por código (InstancedMesh) e seleção         | —            |
| 4    | Visão do assento em primeira pessoa                           | —            |
| 5    | Back-end: API, banco, reserva temporária, checkout (sandbox)  | —            |
| 6    | Acabamento: mobile, desempenho, deploy                        | —            |

## Stack

- **TypeScript** em todo o projeto
- **React 19 + Vite**: interface e build
- **Three.js + React Three Fiber + drei**: renderização 3D
- **Zustand**: estado global (visão ativa, depois setor, cadeira e carrinho)
- **Tailwind CSS 4**: estilo da interface sobre o canvas
- **glTF Transform + meshoptimizer + sharp**: pipeline de otimização do modelo 3D
- **oxlint + Prettier**: qualidade e formatação de código

## Como rodar

Pré-requisito: **Node.js 22+**.

```bash
npm install
npm run dev
```

Abra <http://localhost:5173>.

| Script                   | O que faz                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Servidor de desenvolvimento com recarregamento automático   |
| `npm run build`          | Checagem de tipos + build de produção em `apps/web/dist`    |
| `npm run preview`        | Serve o build de produção localmente                        |
| `npm run lint`           | Lint com oxlint                                             |
| `npm run typecheck`      | Checagem de tipos do TypeScript                             |
| `npm run format`         | Formata todo o código com Prettier                          |
| `npm run model:optimize` | Regera `bombonera.glb` a partir do modelo bruto (veja docs) |

### VS Code

Ao abrir a pasta, o VS Code sugere as extensões recomendadas (Prettier, oxc, Tailwind, glTF Tools...).
Formatação e correções de lint rodam ao salvar. Em **Run and Debug**, use _"Depurar no Chrome"_ para colocar breakpoints direto no código React.

## Estrutura

```
bombonera-tickets/
├── apps/
│   └── web/                     # Front-end (React + Three.js)
│       ├── public/models/       # bombonera.glb otimizado (6,8 MB)
│       └── src/
│           ├── components/ui/   # Interface HTML sobre o 3D (header, botões, loading)
│           ├── config/          # Constantes do estádio (dimensões, limites da câmera)
│           ├── features/
│           │   └── stadium/     # Cena 3D: canvas, modelo, câmera, ambiente
│           └── store/           # Estado global (Zustand)
├── assets-src/                  # Modelo bruto do Sketchfab (fora do Git)
├── docs/                        # Arquitetura e pipeline do modelo 3D
└── scripts/                     # optimize-model.mjs
```

Mais detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e [`docs/MODELO-3D.md`](docs/MODELO-3D.md).

## Créditos

Este trabalho usa o modelo [“La Bombonera (Boca Juniors)”](https://sketchfab.com/3d-models/la-bombonera-boca-juniors-82204c5963b84ac593c26127ac36fbfa)
de [A1905](https://sketchfab.com/al1905), licenciado sob [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
O modelo foi recentralizado e comprimido para uso na web.

O código-fonte deste repositório está sob a licença [MIT](LICENSE). A licença MIT não se aplica ao modelo 3D nem às marcas do clube.
