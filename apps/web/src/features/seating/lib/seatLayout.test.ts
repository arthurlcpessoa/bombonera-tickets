/**
 * Testes do gerador de cadeiras. Rode com `npm test`.
 * O gerador é uma função pura: basta chamá-la e conferir o resultado, sem navegador nem 3D.
 */
import { describe, expect, it } from 'vitest';
import { SEAT_LAYOUT } from '@/config/stadium';
import { SECTORS, TIER_LABELS, type Sector } from '@/features/seating/data/sectors';
import { DEFAULT_STANDS_MODEL } from '@/features/seating/data/standsModel';
import { generateSeats, getSectorSeats, parseSeatId, seatId, seatsByRow } from './seatLayout';
import { sectorSurface } from './sectorGeometry';
import { hasHeadroom, samplePath, tierHeight } from './stadiumPath';

const model = DEFAULT_STANDS_MODEL;
const seatsOf = (sector: Sector) => getSectorSeats(sector, model);
const allSeats = SECTORS.flatMap(seatsOf);

describe('generateSeats', () => {
  it('gera ids únicos em todo o estádio', () => {
    const ids = new Set(allSeats.map((s) => s.id));
    expect(ids.size).toBe(allSeats.length);
  });

  it('todo setor tem cadeiras e a capacidade total é plausível', () => {
    for (const sector of SECTORS) expect(seatsOf(sector).length).toBeGreaterThan(0);

    // Resumo impresso no terminal: cadeiras por bandeja e o maior setor.
    const byTier = new Map<string, number>();
    for (const sector of SECTORS) {
      const label = TIER_LABELS[sector.tier];
      byTier.set(label, (byTier.get(label) ?? 0) + seatsOf(sector).length);
    }
    const biggest = [...SECTORS].sort((a, b) => seatsOf(b).length - seatsOf(a).length)[0];
    console.info(
      [
        ...[...byTier].map(([label, n]) => `${label}: ${n.toLocaleString('pt-BR')}`),
        `Total: ${allSeats.length.toLocaleString('pt-BR')} cadeiras`,
        `Maior setor: ${biggest.name} (${seatsOf(biggest).length} cadeiras)`,
      ].join('\n'),
    );

    // A Bombonera real tem ~54 mil lugares, mas parte deles (camarotes, palcos altos,
    // pé-direito) não está modelada aqui. Esperamos a mesma ordem de grandeza.
    expect(allSeats.length).toBeGreaterThan(25_000);
    expect(allSeats.length).toBeLessThan(70_000);
  });

  it('toda cadeira fica dentro do setor e na altura prevista pelo perfil', () => {
    for (const sector of SECTORS) {
      const surface = sectorSurface(sector.shape, model);
      for (const seat of seatsOf(sector)) {
        expect(seat.a).toBeGreaterThanOrEqual(0);
        expect(seat.a).toBeLessThanOrEqual(1);
        expect(seat.b).toBeGreaterThan(0);
        expect(seat.b).toBeLessThan(1);

        const expectedY =
          sector.shape.kind === 'curved'
            ? tierHeight(model.profiles[sector.shape.tier], seat.b)
            : surface(seat.a, seat.b)[1];
        expect(seat.position[1]).toBeCloseTo(expectedY, 5);
      }
    }
  });

  it('toda cadeira olha para o campo', () => {
    for (const seat of allSeats) {
      // Direção da cadeira (yaw) e direção da cadeira até o centro do campo, no chão.
      const facing = [Math.sin(seat.yaw), Math.cos(seat.yaw)];
      const toField = [-seat.position[0], -seat.position[2]];
      const dot = facing[0] * toField[0] + facing[1] * toField[1];
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('os olhos ficam acima e um pouco atrás do assento', () => {
    for (const seat of allSeats.slice(0, 500)) {
      expect(seat.eye[1]).toBeGreaterThan(seat.position[1] + 1);
    }
  });

  it('cadeiras vizinhas na fila ficam a um passo de cadeira uma da outra', () => {
    for (const sector of SECTORS) {
      const { shape } = sector;
      const pitch = SEAT_LAYOUT.pitch[shape.kind];
      for (const row of seatsByRow(seatsOf(sector))) {
        for (let i = 1; i < row.length; i++) {
          const [p, q] = [row[i - 1].position, row[i].position];
          const gap = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
          // A distância em linha reta é um pouco menor que a medida pela curva da fila.
          expect(gap).toBeGreaterThan(pitch - 0.03);
          if (gap < pitch + 0.03) continue;
          // Buraco maior só onde a cadeira do meio foi tirada por falta de folga acima da cabeça.
          expect(shape.kind).toBe('curved');
          if (shape.kind !== 'curved') continue;
          const a = (row[i - 1].a + row[i].a) / 2;
          const t = shape.t0 + (shape.t1 - shape.t0) * a;
          expect(hasHeadroom(model.corrections?.[shape.tier], row[i].row, t)).toBe(false);
        }
      }
    }
  });

  it('nenhuma cadeira fica num trecho sem folga acima da cabeça', () => {
    for (const sector of SECTORS) {
      const { shape } = sector;
      if (shape.kind !== 'curved') continue;
      for (const seat of seatsOf(sector)) {
        const t = shape.t0 + (shape.t1 - shape.t0) * seat.a;
        expect(hasHeadroom(model.corrections?.[shape.tier], seat.row, t)).toBe(true);
      }
    }
  });

  it('um trecho sem folga tira as cadeiras daquela fila, e só dela', () => {
    const sector = SECTORS.find((s) => s.id === 'lower-4')!;
    if (sector.shape.kind !== 'curved' || !model.corrections) throw new Error('setor curvo');
    const { t0, t1 } = sector.shape;
    // Um "muro" inventado na fila 3, cobrindo o meio do setor.
    const blocked = {
      ...model,
      corrections: {
        ...model.corrections,
        lower: {
          ...model.corrections.lower,
          noHeadroom: [[3, t0 + (t1 - t0) * 0.4, t0 + (t1 - t0) * 0.6]] as const,
        },
      },
    };
    const before = seatsByRow(generateSeats(sector, model)).map((row) => row.length);
    const after = seatsByRow(generateSeats(sector, blocked)).map((row) => row.length);
    expect(after[2]).toBeLessThan(before[2]);
    expect(after.filter((_, i) => i !== 2)).toEqual(before.filter((_, i) => i !== 2));
  });

  it('fila 1 é a da frente (a mais baixa) e a numeração cresce com a', () => {
    for (const sector of SECTORS) {
      const rows = seatsByRow(seatsOf(sector));
      expect(rows[0][0].position[1]).toBeLessThan(rows.at(-1)![0].position[1]);
      for (const row of rows) {
        row.forEach((seat, i) => expect(seat.number).toBe(i + 1));
        for (let i = 1; i < row.length; i++) expect(row[i].a).toBeGreaterThan(row[i - 1].a);
      }
    }
  });

  it('é determinístico: mesma semente → mesmo status', () => {
    const sector = SECTORS[5];
    const first = generateSeats(sector, model).map((s) => s.status);
    const second = generateSeats(sector, model).map((s) => s.status);
    expect(second).toEqual(first);
    expect(first).toContain('sold');
    expect(first).toContain('available');
  });

  it('nas curvas, as filas de cima têm pelo menos tantas cadeiras quanto as de baixo', () => {
    // "Curva" = setor em que a direção do U muda entre o começo e o fim (cantos). Nas retas das
    // cabeceiras as filas têm o mesmo tamanho, a menos de 1 cadeira da tabela de correção.
    const bends = (s: Sector) => {
      if (s.shape.kind !== 'curved') return false;
      const [p, q] = [samplePath(s.shape.t0, model.path), samplePath(s.shape.t1, model.path)];
      return p.nx * q.nx + p.nz * q.nz < 0.999;
    };
    const curves = SECTORS.filter(bends);
    expect(curves.length).toBeGreaterThan(0);
    for (const sector of curves) {
      const rows = seatsByRow(seatsOf(sector));
      expect(rows.at(-1)!.length).toBeGreaterThanOrEqual(rows[0].length);
    }
  });

  it('capacidade e lugares livres do setor = contagem das cadeiras', () => {
    for (const sector of SECTORS) {
      const seats = seatsOf(sector);
      expect(sector.capacity).toBe(seats.length);
      expect(sector.available).toBe(seats.filter((s) => s.status === 'available').length);
    }
  });
});

describe('ids das cadeiras', () => {
  it('ida e volta: seatId → parseSeatId', () => {
    expect(seatId('upper-3', 12, 7)).toBe('upper-3:F12-C07');
    expect(parseSeatId('upper-3:F12-C07')).toEqual({ sectorId: 'upper-3', row: 12, number: 7 });
    expect(parseSeatId('qualquer coisa')).toBeNull();
  });
});
