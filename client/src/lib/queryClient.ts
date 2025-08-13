import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authManager } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    // Anexar a resposta original ao erro para permitir acesso ao status
    (error as any).response = res;
    (error as any).status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Obter o código de acesso do usuário atual para usar como token
  const currentUser = authManager.getCurrentUser();
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Adicionar o token de autenticação se o usuário estiver logado
  if (currentUser?.code) {
    headers["Authorization"] = `Bearer ${currentUser.code}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  
  // Para POST de appointments, se for erro 500, retornar a response sem lançar erro
  if (method === "POST" && url.includes("/api/appointments") && res.status === 500) {
    return res;
  }
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Obter o código de acesso do usuário atual para usar como token
    const currentUser = authManager.getCurrentUser();
    const headers: Record<string, string> = {};
    
    // Adicionar o token de autenticação se o usuário estiver logado
    if (currentUser?.code) {
      headers["Authorization"] = `Bearer ${currentUser.code}`;
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });
    
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
