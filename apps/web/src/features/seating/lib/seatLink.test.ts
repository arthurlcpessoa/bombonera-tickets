import { describe, expect, it } from 'vitest';
import { readSeatParam, withSeatParam } from './seatLink';

describe('readSeatParam', () => {
  it('lê o id da cadeira, inclusive com ":" codificado', () => {
    expect(readSeatParam('?assento=upper-3:F12-C07')).toBe('upper-3:F12-C07');
    expect(readSeatParam('?debug&assento=upper-3%3AF12-C07')).toBe('upper-3:F12-C07');
  });

  it('ausente ou vazio → null', () => {
    expect(readSeatParam('')).toBeNull();
    expect(readSeatParam('?debug')).toBeNull();
    expect(readSeatParam('?assento=')).toBeNull();
  });
});

describe('withSeatParam', () => {
  it('coloca o id legível e mantém o ?debug sem "="', () => {
    expect(withSeatParam('', 'upper-3:F12-C07')).toBe('?assento=upper-3:F12-C07');
    expect(withSeatParam('?debug', 'lower-1:F01-C01')).toBe('?debug&assento=lower-1:F01-C01');
  });

  it('troca o id existente e remove com null', () => {
    expect(withSeatParam('?assento=a:F01-C01', 'b:F02-C02')).toBe('?assento=b:F02-C02');
    expect(withSeatParam('?debug&assento=a:F01-C01', null)).toBe('?debug');
    expect(withSeatParam('?assento=a:F01-C01', null)).toBe('');
  });

  it('ida e volta: o que é escrito é lido igual', () => {
    expect(readSeatParam(withSeatParam('?debug', 'palcos-3:F06-C21'))).toBe('palcos-3:F06-C21');
  });
});
