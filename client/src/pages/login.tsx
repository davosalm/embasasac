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
    onSuccess: (user) => {
      login(user);
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${user.userName}!`,
      });
      
      // Redirect based on user type
      switch (user.userType) {
        case "admin":
          setLocation("/admin");
          break;
        case "embasa":
          setLocation("/embasa");
          break;
        case "sac":
          setLocation("/sac");
          break;
        default:
          setLocation("/");
      }
    },
    onError: (error: any) => {
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
