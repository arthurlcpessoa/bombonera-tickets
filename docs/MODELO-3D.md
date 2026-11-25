# Pipeline do modelo 3D

## Origem

- **Modelo:** [La Bombonera (Boca Juniors)](https://sketchfab.com/3d-models/la-bombonera-boca-juniors-82204c5963b84ac593c26127ac36fbfa)
- **Autor:** [A1905](https://sketchfab.com/al1905)
- **Licença:** CC BY 4.0. Uso e modificação são livres, desde que o autor seja creditado
  (o crédito aparece no rodapé do site e no README).

## Por que otimizar

| Métrica    | Bruto (Sketchfab) | Otimizado (`bombonera.glb`) |
| ---------- | ----------------- | --------------------------- |
| Tamanho    | 58 MB             | 6,8 MB (≈3,1 MB com gzip)   |
| Triângulos | 834 mil           | 721 mil                     |
| Malhas     | 206               | 80                          |
| Texturas   | PNG/JPEG          | WebP (máx. 2048 px)         |

## Como regerar o `.glb`

1. Baixe o modelo no Sketchfab em **glTF** ("Autoconverted format").
2. Descompacte em `assets-src/bombonera/` (deve ter `scene.gltf`, `scene.bin` e `textures/`).
3. Rode:

   ```bash
   npm run model:optimize
   ```

4. O resultado sai em `apps/web/public/models/bombonera.glb`.

## O que o script faz (`scripts/optimize-model.mjs`)

| Etapa             | Explicação                                                                              |
| ----------------- | --------------------------------------------------------------------------------------- |
| Recentralizar     | Desloca tudo para o centro do gramado ficar em (0, 0, 0)                                |
| `dedup`           | Remove malhas, materiais e texturas duplicados                                          |
| `flatten`         | Achata a hierarquia de nós                                                              |
| `join`            | Junta malhas com o mesmo material: menos _draw calls_ (pedidos de desenho à GPU)        |
| `weld`            | Funde vértices idênticos                                                                |
| `simplify`        | Remove triângulos redundantes com erro visual mínimo                                    |
| `prune`           | Apaga dados que ficaram sem uso                                                         |
| `textureCompress` | Converte texturas para WebP e limita a 2048 px                                          |
| `meshopt`         | Comprime a geometria (extensão `EXT_meshopt_compression`, descomprimida pelo navegador) |

## Características do modelo

- Escala real em metros (campo de ~68 × 105 m).
- Agrupado **por material**, não por setor: por isso setores e cadeiras são gerados por código.
- Nas bandejas curvas, as cadeiras são uma superfície texturizada. Só o lado dos palcos tem cadeiras modeladas.

## Medindo o modelo (`scripts/probe-stands.mjs`)

Como as arquibancadas não vêm separadas no `.glb`, os setores são posicionados por código.
O script `npm run stands:probe` lança raios verticais sobre o modelo e imprime a altura atingida
e o material de cada ponto. Isso serviu para descobrir, por exemplo, que as cadeiras das bandejas
inferior e superior usam os materiais `popu_29` (cabeceiras) e `material_47` (lateral), e a média usa
`material_43`/`material_44`. Veja a seção "Como os setores funcionam" em [ARQUITETURA.md](ARQUITETURA.md).

Se o `.glb` for regerado, rode `npm run stands:calibrate` para medir de novo a tabela de correção.
