import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Adaptador para converter resposta da API em formato compatível com o frontend
const adaptUserData = (apiResponse: any) => {
  if (!apiResponse) return null;

  // Obter dados do usuário, verificando se estão dentro de um objeto data
  const userData = apiResponse.data || apiResponse;
  console.log("Dados brutos do usuário:", userData); // Debug

  // Se o tipo é undefined, null ou vazio, use um fallback
  // Caso contrário, mantenha o tipo original
  const userType = userData.userType || userData.type || "sac";
  console.log("Tipo de usuário detectado:", userType); // Debug

  return {
    ...userData,
    // Garantir que userType seja mantido e tenha prioridade sobre type
    userType: userType,
    userName: userData.userName || userData.name || "Usuário",
  };
};

export default function Login() {
  const [accessCode, setAccessCode] = useState("");
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const loginMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/login", { code });
      return response.json();
    },
    onSuccess: (response) => {
      console.log("Resposta da API:", response);
      
      // Adaptar os dados da resposta para o formato esperado pela aplicação
      const adaptedUser = adaptUserData(response);
      
      if (!adaptedUser) {
        toast({
          title: "Erro no login",
          description: "Falha ao processar dados do usuário",
          variant: "destructive",
        });
        return;
      }
      
      // Login com os dados adaptados
      login(adaptedUser);
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${adaptedUser.userName || 'Usuário'}!`,
      });
      
      // Redirect based on user type
      const userType = adaptedUser.userType;
      console.log("Tipo de usuário para redirecionamento:", userType);
      
      switch (userType) {
        case "admin":
          console.log("Redirecionando para admin dashboard");
          setLocation("/admin");
          break;
        case "embasa":
          console.log("Redirecionando para embasa dashboard");
          setLocation("/embasa");
          break;
        case "sac":
          console.log("Redirecionando para sac dashboard");
          setLocation("/sac");
          break;
        default:
          console.log("Tipo desconhecido, redirecionando para sac dashboard");
          setLocation("/sac");
          break;
      }
    },
    onError: (error: any) => {
      console.error("Erro no login:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Código inválido",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, digite o código de acesso",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(accessCode);
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="text-white h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sistema EMBASA
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Agendamento de Visitas Técnicas
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-sm font-medium">
                Código de Acesso
              </Label>
              <Input
                id="accessCode"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Digite seu código"
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Acessando..." : "Acessar Sistema"}
            </Button>
          </form>
          <div className="flex items-center justify-center pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <span className="text-sm">Alternar tema</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
