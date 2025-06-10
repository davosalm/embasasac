import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth";
import { Moon, Sun, LogOut, Calendar, User, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefresh = () => {
    // Invalidate and refetch all queries
    queryClient.invalidateQueries();
    toast({
      title: "Sistema atualizado",
      description: "Todos os dados foram atualizados com sucesso"
    });
  };

  if (!currentUser) return null;

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="text-white h-5 w-5" />
            </div>
            <div className="flex items-center">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sistema EMBASA
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentUser.userName}
                </p>
              </div>
              <Button 
                onClick={handleRefresh}
                className="ml-4 bg-primary hover:bg-primary/90 text-white flex items-center space-x-2 px-4"
                size="lg"
              >
                <RefreshCw className="h-5 w-5" />
                <span>Atualizar Sistema</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <User className="text-white h-4 w-4" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {currentUser.userName}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
