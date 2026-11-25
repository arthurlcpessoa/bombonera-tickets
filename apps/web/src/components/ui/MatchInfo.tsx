import { MATCH, type Team } from '@/features/match/data/match';
import { formatKickoff } from '@/features/match/lib/formatKickoff';

/**
 * Cartão do jogo à venda: campeonato, os escudos dos dois times, data, hora e estádio.
 * É o título da página (h1): diz ao visitante, e ao leitor de tela, para qual jogo é o ingresso.
 */
export function MatchInfo() {
  const { date, time } = formatKickoff(MATCH.kickoff);

  return (
    <div className="glass-card pointer-events-auto rounded-3xl px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-boca-gold text-[11px] font-semibold tracking-wider uppercase">
        {MATCH.competition} · {MATCH.round}
      </p>

      {/*
       * Só os escudos aparecem; o h1 continua com texto para quem não vê a tela: o leitor de tela
       * lê o alt de cada imagem e o "contra" (texto sr-only, invisível na tela):
       * "Boca Juniors contra River Plate".
       */}
      <h1 className="mt-2 flex items-center gap-3">
        <TeamCrest team={MATCH.home} />
        <span className="text-sm font-semibold text-white/40" aria-hidden>
          ×
        </span>
        <span className="sr-only">contra</span>
        <TeamCrest team={MATCH.away} />
      </h1>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-white/70 sm:text-sm">
        <time dateTime={MATCH.kickoff} className="font-semibold text-white">
          {date} · {time}
        </time>
        <span aria-hidden>·</span>
        <span>{MATCH.venue}</span>
      </p>
    </div>
  );
}

/** Escudo do time. title = o nome aparece ao parar o mouse em cima. */
function TeamCrest({ team }: { team: Team }) {
  return (
    <img
      src={team.crest}
      alt={team.name}
      title={team.name}
      // Largura e altura reservam o espaço antes da imagem carregar (o layout não "pula").
      width={34}
      height={40}
      className="h-9 w-auto drop-shadow-md sm:h-10"
    />
  );
}
