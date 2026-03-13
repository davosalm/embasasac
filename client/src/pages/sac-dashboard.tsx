import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Building, CheckCircle, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Header } from "@/components/header";
import { BookingModal } from "@/components/modals/booking-modal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { TimeSlotWithEmbasa, AppointmentWithDetails } from "@shared/schema";

export default function SacDashboard() {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlotWithEmbasa | null>(null);
  const [filterEmbasa, setFilterEmbasa] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<AppointmentWithDetails | null>(null);
  const [showPastDates, setShowPastDates] = useState(false);
  
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { 
    data: availableSlots = [], 
    isLoading: slotsLoading,
    refetch: refetchSlots 
  } = useQuery<TimeSlotWithEmbasa[]>({
    queryKey: [showPastDates ? "/api/time-slots/available?includePast=true" : "/api/time-slots/available"],
  });
  
  // pastSlots não é mais necessário, usamos includePast na query anterior
  
  const { 
    data: myAppointments = [], 
    isLoading: appointmentsLoading,
    refetch: refetchAppointments 
  } = useQuery<AppointmentWithDetails[]>({
    queryKey: [`/api/appointments/sac?sacId=${currentUser?.id}`],
    enabled: !!currentUser,
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      if (!currentUser) throw new Error("Usuário não autenticado");
      
      const response = await apiRequest(
        "DELETE", 
        `/api/appointments/${appointmentId}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao excluir agendamento");
      }
      
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi excluído com sucesso",
      });
      
      // Invalidar automaticamente todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/time-slots/available"] });
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/sac?sacId=${currentUser?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      
      // Refetch manual para garantir dados atualizados
      refetchSlots();
      refetchAppointments();
      setAppointmentToDelete(null);
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir agendamento",
        description: error.message || "Ocorreu um erro ao excluir o agendamento",
        variant: "destructive",
      });
    }
  });

  const handleBookSlot = (slot: TimeSlotWithEmbasa) => {
    setSelectedTimeSlot(slot);
    setBookingModalOpen(true);
  };

  const handleDeleteAppointment = (appointment: AppointmentWithDetails) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAppointment = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete.id);
    }
  };

  const refreshData = () => {
    // Invalidar queries e refazer fetch
    queryClient.invalidateQueries({ queryKey: ["/api/time-slots/available"] });
    queryClient.invalidateQueries({ queryKey: [`/api/appointments/sac?sacId=${currentUser?.id}`] });
    refetchSlots();
    refetchAppointments();
  };

  // Get unique EMBASA units for filtering
  const embasaUnits = Array.from(
    new Set(availableSlots.map(slot => slot.embasa.userName))
  );

  // Filter slots based on selected EMBASA unit
  const slotsToDisplay = availableSlots;
  const filteredSlots = filterEmbasa === "all" 
    ? slotsToDisplay
    : slotsToDisplay.filter(slot => slot.embasa.userName === filterEmbasa);
  
  // Sort slots by date
  const sortedSlots = [...filteredSlots].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return showPastDates ? dateB - dateA : dateA - dateB; // Reverse order for past dates
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Agendar Visita Técnica
            </h2>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setShowPastDates(!showPastDates)}
                variant={showPastDates ? "default" : "outline"}
                className="flex items-center space-x-2"
              >
                <span>{showPastDates ? "Mostrando datas passadas" : "Ver datas passadas"}</span>
              </Button>
              
              <Button
                onClick={refreshData}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Atualizar Horários</span>
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Filtrar por:
                </span>
                <Select value={filterEmbasa} onValueChange={setFilterEmbasa}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {embasaUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Tabs defaultValue="available" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="available" className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Horários Disponíveis</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Agendamentos Pendentes</span>
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Horários Confirmados</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Histórico Completo</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="available">
              {/* Available Appointments */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {slotsLoading || (showPastDates && pastSlotsLoading) ? (
                  <div className="col-span-full text-center py-12">
                    <div className="text-gray-500 dark:text-gray-400">
                      Carregando horários disponíveis...
                    </div>
                  </div>
                ) : sortedSlots.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <div className="text-gray-500 dark:text-gray-400">
                      Nenhum horário disponível no momento
                    </div>
                  </div>
                ) : (
                  sortedSlots.map((slot) => (
                    <Card
                      key={slot.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-200 dark:hover:border-primary-800"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                              <Building className="text-blue-600 dark:text-blue-400 h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {slot.embasa.userName}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Disponível
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Livre
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>{formatDate(slot.date)}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>{formatTimeRange(slot.startTime, slot.endTime)}</span>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleBookSlot(slot)}
                          className="w-full"
                        >
                          Agendar Visita
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="pending">
              {/* Pending Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle>Agendamentos Aguardando Confirmação</CardTitle>
                </CardHeader>
                <CardContent>
                  {appointmentsLoading ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Carregando agendamentos...
                      </div>
                    </div>
                  ) : myAppointments.filter(apt => !apt.isConfirmed).length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Você não possui agendamentos pendentes
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {myAppointments.filter(apt => !apt.isConfirmed).map((appointment) => (
                        <div key={appointment.id} className="py-6 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                              <Clock className="text-yellow-600 dark:text-yellow-400 h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {appointment.clientName} - SS: {appointment.ssNumber}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(appointment.timeSlot.date)} • {formatTimeRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                EMBASA: {appointment.timeSlot.embasa.userName}
                              </div>
                              {appointment.comments && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  Comentários: {appointment.comments}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Aguardando Confirmação
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAppointment(appointment)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="confirmed">
              {/* Confirmed Appointments */}
              <Card>
                <CardHeader>
                  <CardTitle>Horários Confirmados pela EMBASA</CardTitle>
                </CardHeader>
                <CardContent>
                  {appointmentsLoading ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Carregando agendamentos confirmados...
                      </div>
                    </div>
                  ) : myAppointments.filter(apt => apt.isConfirmed).length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Nenhum agendamento confirmado ainda
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {myAppointments.filter(apt => apt.isConfirmed).map((appointment) => (
                        <div key={appointment.id} className="py-6 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                              <CheckCircle className="text-green-600 dark:text-green-400 h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {appointment.clientName} - SS: {appointment.ssNumber}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(appointment.timeSlot.date)} • {formatTimeRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                EMBASA: {appointment.timeSlot.embasa.userName}
                              </div>
                              {appointment.comments && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  Comentários: {appointment.comments}
                                </div>
                              )}
                              {appointment.confirmedAt && (
                                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  Confirmado em: {new Date(appointment.confirmedAt).toLocaleDateString('pt-BR')} às {new Date(appointment.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Confirmado
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              {/* Complete History */}
              <Card>
                <CardHeader>
                  <CardTitle>Histórico Completo de Agendamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {appointmentsLoading ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Carregando histórico...
                      </div>
                    </div>
                  ) : myAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Você ainda não possui agendamentos
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {myAppointments
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((appointment) => (
                        <div key={appointment.id} className="py-6 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              appointment.isConfirmed 
                                ? 'bg-green-100 dark:bg-green-900' 
                                : 'bg-yellow-100 dark:bg-yellow-900'
                            }`}>
                              {appointment.isConfirmed ? (
                                <CheckCircle className="text-green-600 dark:text-green-400 h-5 w-5" />
                              ) : (
                                <Clock className="text-yellow-600 dark:text-yellow-400 h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {appointment.clientName} - SS: {appointment.ssNumber}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(appointment.timeSlot.date)} • {formatTimeRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                EMBASA: {appointment.timeSlot.embasa.userName}
                              </div>
                              {appointment.comments && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  Comentários: {appointment.comments}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-1">
                                Criado em: {new Date(appointment.createdAt).toLocaleDateString('pt-BR')} às {new Date(appointment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {appointment.confirmedAt && (
                                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  Confirmado em: {new Date(appointment.confirmedAt).toLocaleDateString('pt-BR')} às {new Date(appointment.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={`${
                              appointment.isConfirmed 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {appointment.isConfirmed ? 'Confirmado' : 'Pendente'}
                            </Badge>
                            {!appointment.isConfirmed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteAppointment(appointment)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {/* Modals */}
      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        timeSlot={selectedTimeSlot}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento para {appointmentToDelete?.clientName}?
              <br />
              SS: {appointmentToDelete?.ssNumber}
              <br />
              Data: {appointmentToDelete && formatDate(appointmentToDelete.timeSlot.date)}
              <br />
              Horário: {appointmentToDelete && formatTimeRange(appointmentToDelete.timeSlot.startTime, appointmentToDelete.timeSlot.endTime)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDeleteAppointment}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
