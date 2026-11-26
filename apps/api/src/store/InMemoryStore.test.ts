import { CURRENT_MATCH } from '../domain/match';
import { testInventory } from '../test/helpers';
import { InMemoryStore } from './InMemoryStore';
import { describeStoreContract } from './storeContract';

// A suíte de contrato contra o armazenamento em memória. Na Fase 5C: a mesma, contra o PostgresStore.
describeStoreContract('InMemoryStore', {
  matchId: CURRENT_MATCH.id,
  createStore: (clock) => new InMemoryStore({ inventory: testInventory(), now: clock.now }),
});
