/**
 * Formata a data e a hora do jogo para a interface.
 *
 * Sempre no fuso de Buenos Aires (onde fica o estádio): quem abre o site de outro país vê o
 * horário local do jogo, que é o que vem impresso no ingresso.
 */
const STADIUM_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: STADIUM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: STADIUM_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** "2026-12-13T17:00:00-03:00" → { date: "Dom, 13 dez", time: "17h00" } */
export function formatKickoff(iso: string): { date: string; time: string } {
  const when = new Date(iso);
  // O Intl devolve "dom., 13 de dez."; tiramos pontos e o "de" para ficar mais enxuto.
  const date = dateFormat.format(when).replaceAll('.', '').replace(' de ', ' ');
  return {
    date: date.charAt(0).toUpperCase() + date.slice(1),
    time: timeFormat.format(when).replace(':', 'h'),
  };
}
