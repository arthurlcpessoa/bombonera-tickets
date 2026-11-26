import type { Match } from '@bombonera/shared';
import { useQuery } from '@tanstack/react-query';
import { TEAM_CRESTS } from '@/features/match/data/teams';
import { formatKickoff } from '@/features/match/lib/formatKickoff';
import { currentMatchQuery } from '@/lib/queries';

/**
 * Cartão do jogo à venda (vindo da API): campeonato, os escudos dos dois times, data, hora e estádio.
 * É o título da página (h1): diz ao visitante, e ao leitor de tela, para qual jogo é o ingresso.
 */
export function MatchInfo() {
  const { data: match, isError } = useQuery(currentMatchQuery());

  return (
    <div className="glass-card pointer-events-auto rounded-3xl px-4 py-3 sm:px-5 sm:py-4">
      {match ? (
        <MatchDetails match={match} />
      ) : (
        // Carregando: um "esqueleto" do mesmo tamanho, para o layout não pular quando chegar.
        <div aria-busy={!isError} className="w-52">
          <h1 className="sr-only">Ingressos para La Bombonera</h1>
          <div className="h-3 w-40 animate-pulse rounded bg-white/15" />
          <div className="mt-3 h-9 w-24 animate-pulse rounded bg-white/10" />
          <p className="mt-2 text-xs text-white/60">
            {isError ? 'Não foi possível carregar o jogo.' : 'Carregando o jogo…'}
          </p>
        </div>
      )}
    </div>
  );
}

function MatchDetails({ match }: { match: Match }) {
  const { date, time } = formatKickoff(match.kickoff);
  return (
    <>
      <p className="text-boca-gold text-[11px] font-semibold tracking-wider uppercase">
        {match.competition} · {match.round}
      </p>

      {/*
       * Só os escudos aparecem; o h1 continua com texto para quem não vê a tela: o leitor de tela
       * lê o alt de cada imagem e o "contra" (texto sr-only, invisível na tela):
       * "Boca Juniors contra River Plate".
       */}
      <h1 className="mt-2 flex items-center gap-3">
        <TeamCrest team={match.home} />
        <span className="text-sm font-semibold text-white/40" aria-hidden>
          ×
        </span>
        <span className="sr-only">contra</span>
        <TeamCrest team={match.away} />
      </h1>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-white/70 sm:text-sm">
        <time dateTime={match.kickoff} className="font-semibold text-white">
          {date} · {time}
        </time>
        <span aria-hidden>·</span>
        <span>{match.venue}</span>
      </p>
    </>
  );
}

/** Escudo do time (ou o nome, se não houver escudo). title = o nome aparece ao parar o mouse. */
function TeamCrest({ team }: { team: Match['home'] }) {
  const crest = TEAM_CRESTS[team.id];
  if (!crest) return <span className="text-sm font-bold">{team.name}</span>;
  return (
    <img
      src={crest}
      alt={team.name}
      title={team.name}
      // Largura e altura reservam o espaço antes da imagem carregar (o layout não "pula").
      width={34}
      height={40}
      className="h-9 w-auto drop-shadow-md sm:h-10"
    />
  );
}
