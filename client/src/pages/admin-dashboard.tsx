import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { CreateCodeModal } from "@/components/modals/create-code-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AccessCode } from "@shared/schema";

export default function AdminDashboard() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accessCodes = [], isLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
  });

  const deleteCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/access-codes/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Código excluído com sucesso",
        description: "O código foi removido do sistema",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir código",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCode = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este código?")) {
      deleteCodeMutation.mutate(id);
    }
  };

  const getBadgeVariant = (userType: string) => {
    switch (userType) {
      case "admin":
        return "destructive";
      case "embasa":
        return "default";
      case "sac":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case "admin":
        return "Administrador";
      case "embasa":
        return "EMBASA";
      case "sac":
        return "SAC";
      default:
        return userType;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Painel Administrativo
            </h2>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Código</span>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Códigos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Carregando códigos...
                  </div>
                </div>
              ) : accessCodes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Nenhum código encontrado
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(code.userType)}>
                            {getUserTypeLabel(code.userType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{code.userName}</TableCell>
                        <TableCell>
                          <Badge variant={code.isActive ? "default" : "secondary"}>
                            {code.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-primary-600 hover:text-primary-900 dark:text-primary-400"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCode(code.id)}
                              disabled={deleteCodeMutation.isPending}
                              className="text-red-600 hover:text-red-900 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateCodeModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
