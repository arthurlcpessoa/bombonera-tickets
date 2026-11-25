import { readSeatParam, withSeatParam } from '@/features/seating/lib/seatLink';
import { useSeatViewStore } from './useSeatViewStore';

/**
 * Liga a visão do assento à barra de endereço. Chamado uma vez, antes do primeiro render:
 *
 * 1. Se a página abriu com ?assento=..., entra direto na visão daquela cadeira (a câmera já
 *    nasce sentada nela). Id inválido: é ignorado, sai da URL e um aviso curto aparece.
 * 2. Daí em diante, cada entrada, troca ou saída atualiza a URL com history.replaceState:
 *    o endereço muda sem recarregar a página e sem encher o botão "voltar" de entradas.
 */
export function syncSeatViewWithUrl() {
  const store = useSeatViewStore.getState();
  const linked = readSeatParam(window.location.search);
  if (linked && !store.enterSeatView(linked)) {
    store.showNotice('Não encontramos a cadeira desse link. Mostrando o estádio.');
    replaceSeatParam(null);
  }

  useSeatViewStore.subscribe((state, prev) => {
    if (state.viewingSeatId !== prev.viewingSeatId) replaceSeatParam(state.viewingSeatId);
  });
}

function replaceSeatParam(seatId: string | null) {
  const { pathname, search, hash } = window.location;
  const next = withSeatParam(search, seatId);
  if (next !== search) window.history.replaceState(null, '', pathname + next + hash);
}
