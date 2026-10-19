import { DEFAULT_COMPANY } from '../core/budget.js';

const STORAGE_KEY = 'urutau_orc_v1';

const createEmptyDatabase = () => ({
  v: 1,
  seq: 0,
  lista: [],
  precos: {},
  empresa: { ...DEFAULT_COMPANY },
  atual: null,
});

export function loadDatabase() {
  try {
    const database = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (database?.v === 1) return database;
  } catch {
    // Dados inválidos não impedem o início de um novo orçamento.
  }
  return createEmptyDatabase();
}

export function saveDatabase(database) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    return true;
  } catch {
    return false;
  }
}
