// Sistema simples de autenticação com localStorage

export interface User {
  email: string;
  name: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

const STORAGE_KEY = 'precofacil_auth';
const USERS_KEY = 'precofacil_users';

/**
 * Registra novo usuário
 */
export function register(email: string, password: string, name: string): { success: boolean; error?: string } {
  try {
    // Validações básicas
    if (!email || !password || !name) {
      return { success: false, error: 'Preencha todos os campos' };
    }

    if (!email.includes('@')) {
      return { success: false, error: 'Email inválido' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Senha deve ter no mínimo 6 caracteres' };
    }

    // Busca usuários existentes
    const users = getStoredUsers();

    // Verifica se email já existe
    if (users.some(u => u.email === email)) {
      return { success: false, error: 'Email já cadastrado' };
    }

    // Adiciona novo usuário
    users.push({ email, password, name });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    return { success: true };
  } catch (error) {
    console.error('Erro ao registrar:', error);
    return { success: false, error: 'Erro ao registrar. Tente novamente.' };
  }
}

/**
 * Faz login do usuário
 */
export function login(email: string, password: string): { success: boolean; error?: string; user?: User } {
  try {
    // Validações básicas
    if (!email || !password) {
      return { success: false, error: 'Preencha todos os campos' };
    }

    // Busca usuários
    const users = getStoredUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return { success: false, error: 'Email ou senha incorretos' };
    }

    // Salva sessão
    const authState: AuthState = {
      isAuthenticated: true,
      user: { email: user.email, name: user.name },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authState));

    return { success: true, user: { email: user.email, name: user.name } };
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
  }
}

/**
 * Faz logout do usuário
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Verifica se usuário está autenticado
 */
export function getAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { isAuthenticated: false, user: null };
    }

    const authState: AuthState = JSON.parse(stored);
    return authState;
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return { isAuthenticated: false, user: null };
  }
}

/**
 * Busca usuários armazenados
 */
function getStoredUsers(): Array<{ email: string; password: string; name: string }> {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
}
