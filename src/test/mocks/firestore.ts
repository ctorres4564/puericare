/**
 * Fake em memória do `firebase/firestore`, cobrindo só o subconjunto da API
 * usado por src/services/*.ts (collection, doc, getDoc, getDocs, query,
 * where com "==", setDoc, updateDoc, deleteDoc, runTransaction,
 * serverTimestamp, Timestamp).
 *
 * Não valida regras de segurança nem tipos do Firestore real — isso é
 * responsabilidade dos testes em tests/firestore.rules.test.ts (Emulator).
 * Aqui o objetivo é isolar a lógica dos services (services/*.ts) de uma
 * conexão real, para testes rápidos e sem dependências externas.
 *
 * `runTransaction`: as transações são SERIALIZADAS (uma fila de promises) —
 * duas chamadas concorrentes a `runTransaction` nunca executam entrelaçadas
 * aqui, cada uma roda do início ao fim antes da próxima começar. Isso é uma
 * aproximação razoável do isolamento serializável real do Firestore (para
 * testar "duas emissões concorrentes nunca recebem a mesma versão"), mas NÃO
 * simula retry por conflito de leitura — essa garantia real depende do
 * backend e é validada separadamente pelo Firestore Emulator
 * (tests/firestore.rules.test.ts).
 *
 * Uso num arquivo de teste (o vi.mock precisa estar escrito literalmente
 * ali, por causa do hoisting do Vitest — não dá para encapsular numa
 * função helper importada):
 *
 *   vi.mock('firebase/firestore', () => import('../test/mocks/firestore'));
 *   vi.mock('@/lib/firebase/firestore', () => ({ getFirebaseDb: () => ({}) }));
 */

type DocData = Record<string, unknown>;

interface DocRef {
  __type: 'doc';
  collection: string;
  id: string;
}

interface CollectionRef {
  __type: 'collection';
  name: string;
}

interface WhereConstraint {
  __type: 'where';
  field: string;
  op: string;
  value: unknown;
}

interface QueryRef {
  __type: 'query';
  collection: string;
  constraints: WhereConstraint[];
}

const store = new Map<string, Map<string, DocData>>();
let autoIdCounter = 0;

function collectionMap(name: string): Map<string, DocData> {
  let m = store.get(name);
  if (!m) {
    m = new Map();
    store.set(name, m);
  }
  return m;
}

export function __reset(): void {
  store.clear();
  autoIdCounter = 0;
}

/** Lê o estado bruto de uma coleção (para asserções nos testes). */
export function __getRaw(collectionName: string, id: string): DocData | undefined {
  return store.get(collectionName)?.get(id);
}

export function collection(_db: unknown, name: string): CollectionRef {
  return { __type: 'collection', name };
}

export function doc(refOrDb: CollectionRef | unknown, ...rest: string[]): DocRef {
  if (refOrDb && (refOrDb as CollectionRef).__type === 'collection') {
    // doc(collectionRef) → gera id automático
    autoIdCounter += 1;
    return { __type: 'doc', collection: (refOrDb as CollectionRef).name, id: `auto-${autoIdCounter}` };
  }
  // doc(db, collectionName, id)
  const [collectionName, id] = rest;
  return { __type: 'doc', collection: collectionName, id };
}

export async function setDoc(ref: DocRef, data: DocData): Promise<void> {
  collectionMap(ref.collection).set(ref.id, { ...data });
}

export async function getDoc(ref: DocRef) {
  const data = collectionMap(ref.collection).get(ref.id);
  return {
    id: ref.id,
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
  };
}

export async function updateDoc(ref: DocRef, updates: DocData): Promise<void> {
  const existing = collectionMap(ref.collection).get(ref.id);
  if (!existing) {
    throw new Error(`[fake-firestore] updateDoc: documento ${ref.collection}/${ref.id} não existe`);
  }
  collectionMap(ref.collection).set(ref.id, { ...existing, ...updates });
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  collectionMap(ref.collection).delete(ref.id);
}

export function where(field: string, op: string, value: unknown): WhereConstraint {
  return { __type: 'where', field, op, value };
}

export function query(ref: CollectionRef, ...constraints: WhereConstraint[]): QueryRef {
  return { __type: 'query', collection: ref.name, constraints };
}

export async function getDocs(refOrQuery: CollectionRef | QueryRef) {
  const isQuery = (refOrQuery as QueryRef).__type === 'query';
  const collectionName = isQuery ? (refOrQuery as QueryRef).collection : (refOrQuery as CollectionRef).name;
  const constraints = isQuery ? (refOrQuery as QueryRef).constraints : [];

  const docs = Array.from(collectionMap(collectionName).entries())
    .filter(([, data]) =>
      constraints.every((c) => {
        if (c.op !== '==') throw new Error(`[fake-firestore] operador não suportado: ${c.op}`);
        return data[c.field] === c.value;
      })
    )
    .map(([id, data]) => ({ id, data: () => ({ ...data }) }));

  return { docs, size: docs.length, empty: docs.length === 0 };
}

interface FakeTransaction {
  get(ref: DocRef): Promise<{ id: string; exists: () => boolean; data: () => DocData | undefined }>;
  set(ref: DocRef, data: DocData): void;
  update(ref: DocRef, updates: DocData): void;
  delete(ref: DocRef): void;
}

/** Fila que serializa transações — ver nota de topo do arquivo. */
let transactionQueue: Promise<unknown> = Promise.resolve();

export async function runTransaction<T>(
  _db: unknown,
  updateFunction: (transaction: FakeTransaction) => Promise<T>
): Promise<T> {
  const run = transactionQueue.then(async () => {
    const transaction: FakeTransaction = {
      get: (ref) => getDoc(ref),
      set: (ref, data) => {
        collectionMap(ref.collection).set(ref.id, { ...data });
      },
      update: (ref, updates) => {
        const existing = collectionMap(ref.collection).get(ref.id);
        if (!existing) {
          throw new Error(`[fake-firestore] transaction.update: documento ${ref.collection}/${ref.id} não existe`);
        }
        collectionMap(ref.collection).set(ref.id, { ...existing, ...updates });
      },
      delete: (ref) => {
        collectionMap(ref.collection).delete(ref.id);
      },
    };
    return updateFunction(transaction);
  });
  // Mantém a fila viva mesmo se esta transação rejeitar, sem propagar o erro
  // para as próximas — cada chamador ainda recebe sua própria rejeição via `run`.
  transactionQueue = run.catch(() => undefined);
  return run;
}

export function serverTimestamp(): { __type: 'serverTimestamp' } {
  return { __type: 'serverTimestamp' };
}

export class Timestamp {
  constructor(private seconds: number, private nanoseconds: number) {}
  static now(): Timestamp {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(d: Date): Timestamp {
    return new Timestamp(Math.floor(d.getTime() / 1000), 0);
  }
  toDate(): Date {
    return new Date(this.seconds * 1000);
  }
}
