/**
 * Fake em memória do `firebase/firestore`, cobrindo só o subconjunto da API
 * usado por src/services/*.ts (collection, doc, getDoc, getDocs, query,
 * where com "==", setDoc, updateDoc, serverTimestamp, Timestamp).
 *
 * Não valida regras de segurança nem tipos do Firestore real — isso é
 * responsabilidade dos testes em tests/firestore.rules.test.ts (Emulator).
 * Aqui o objetivo é isolar a lógica dos services (services/*.ts) de uma
 * conexão real, para testes rápidos e sem dependências externas.
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
