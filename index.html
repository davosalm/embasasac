import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Edit, 
  Trash2, 
  History, 
  PlusCircle, 
  RefreshCw, 
  Filter,
  Clock,
  Calendar
} from "lucide-react";
import { Header } from "@/components/header";
import { CreateCodeModal } from "@/components/modals/create-code-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime, formatDate, formatTime } from "@/lib/utils";
import type { AccessCode } from "@shared/schema";

interface ActionLog {
  id: number;
  userId: number;
  userType: string;
  userName: string;
  actionType: string;
  targetType: string;
  targetId: number;
  details: any;
  createdAt: string;
}

export default function AdminDashboard() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("codes");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: accessCodes = [], isLoading } = useQuery<AccessCode[]>({
    queryKey: ["/api/access-codes"],
  });
  
  const { 
    data: actionLogs = [], 
    isLoading: isLoadingLogs,
    refetch: refetchLogs 
  } = useQuery<ActionLog[]>({
    queryKey: ["/api/action-logs"],
    enabled: activeTab === "history"
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
  
  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case "create":
        return "Criação";
      case "delete":
        return "Exclusão";
      case "update":
        return "Atualização";
      default:
        return actionType;
    }
  };
  
  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case "create":
        return <PlusCircle className="h-4 w-4 text-green-500" />;
      case "delete":
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case "update":
        return <Edit className="h-4 w-4 text-amber-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getTargetTypeLabel = (targetType: string) => {
    switch (targetType) {
      case "appointment":
        return "Agendamento";
      case "time_slot":
        return "Horário";
      case "access_code":
        return "Código de Acesso";
      default:
        return targetType;
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
            {activeTab === 'codes' && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Código</span>
              </Button>
            )}
            {activeTab === 'history' && (
              <Button
                onClick={() => refetchLogs()}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Atualizar Histórico</span>
              </Button>
            )}
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="codes" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Códigos de Acesso</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History className="h-4 w-4" />
                <span>Histórico de Ações</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="codes">
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
            </TabsContent>
            
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Ações</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingLogs ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Carregando histórico...
                      </div>
                    </div>
                  ) : actionLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Nenhuma ação registrada
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Ação</TableHead>
                            <TableHead>Recurso</TableHead>
                            <TableHead>Detalhes</TableHead>
                            <TableHead>Data/Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {actionLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{log.userName}</TableCell>
                              <TableCell>
                                <Badge variant={getBadgeVariant(log.userType)}>
                                  {getUserTypeLabel(log.userType)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-1">
                                  {getActionTypeIcon(log.actionType)}
                                  <span>{getActionTypeLabel(log.actionType)}</span>
                                </div>
                              </TableCell>
                              <TableCell>{getTargetTypeLabel(log.targetType)}</TableCell>
                              <TableCell>
                                {log.details ? (
                                  <div className="text-xs">
                                    {log.targetType === 'appointment' && log.details.clientName && (
                                      <>
                                        {log.details.clientName} - SS: {log.details.ssNumber}
                                        <br />
                                        {log.details.date && (
                                          <div className="flex items-center gap-1 text-gray-500">
                                            <Calendar className="h-3 w-3" /> 
                                            {formatDate(log.details.date)}
                                          </div>
                                        )}
                                        {log.details.time && (
                                          <div className="flex items-center gap-1 text-gray-500">
                                            <Clock className="h-3 w-3" /> 
                                            {log.details.time}
                                          </div>
                                        )}
                                        {log.details.embasa && (
                                          <div className="text-gray-500">
                                            Local: {log.details.embasa}
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {log.targetType === 'time_slot' && (
                                      <>
                                        {log.details.date && formatDate(log.details.date)}
                                        {log.details.startTime && log.details.endTime && ` ${log.details.startTime}-${log.details.endTime}`}
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-500 whitespace-nowrap">
                                  {formatRelativeTime(log.createdAt)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <CreateCodeModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
