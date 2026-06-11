export type SavedAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  access_token: string;
  refresh_token?: string;
  session_id?: string;
};

const STORAGE_KEY = "agrimarche_saved_accounts";
const ACTIVE_KEY = "agrimarche_active_account_id";

export function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAccount(account: SavedAccount): void {
  const list = getSavedAccounts().filter((a) => a.id !== account.id);
  list.unshift(account);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
  localStorage.setItem(ACTIVE_KEY, account.id);
}

export function switchToAccount(accountId: string): SavedAccount | null {
  const acc = getSavedAccounts().find((a) => a.id === accountId);
  if (!acc) return null;

  // Isoler la session active dans cet onglet en priorité
  sessionStorage.setItem("access_token", acc.access_token);
  if (acc.refresh_token) sessionStorage.setItem("refresh_token", acc.refresh_token);
  if (acc.session_id) sessionStorage.setItem("session_id", acc.session_id);

  // Mettre à jour le localStorage pour la persistance globale
  localStorage.setItem("access_token", acc.access_token);
  if (acc.refresh_token) localStorage.setItem("refresh_token", acc.refresh_token);
  if (acc.session_id) localStorage.setItem("session_id", acc.session_id);

  localStorage.setItem(ACTIVE_KEY, accountId);
  return acc;
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function removeAccount(accountId: string): void {
  const list = getSavedAccounts().filter((a) => a.id !== accountId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  if (getActiveAccountId() === accountId && list.length > 0) {
    switchToAccount(list[0].id);
  }
}
