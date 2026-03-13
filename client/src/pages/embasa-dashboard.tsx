import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Clock, Trash2, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Building } from "lucide-react";
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
import { CreateSlotModal } from "@/components/modals/create-slot-modal";
import { CreateMultipleSlotsModal } from "@/components/modals/create-multiple-slots-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { TimeSlot, AppointmentWithDetails } from "@shared/schema";

export default function EmbasaDashboard() {
  const [createSlotModalOpen, setCreateSlotModalOpen] = useState(false);
  const [createMultipleSlotsModalOpen, setCreateMultipleSlotsModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterSac, setFilterSac] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<AppointmentWithDetails | null>(null);

  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: timeSlots = [], isLoading, refetch: refetchTimeSlots } = useQuery<TimeSlot[]>({
    queryKey: [`/api/time-slots/embasa?embasaId=${currentUser?.id}`],
    enabled: !!currentUser,
  });

  const { data: allAppointments = [], refetch: refetchAppointments } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/time-slots/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao remover horário");
      }
    },
    onSuccess: () => {
      toast({
        title: "Horário removido com sucesso",
        description: "O horário foi excluído do sistema",
      });
      
      // Invalidar automaticamente todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: [`/api/time-slots/embasa?embasaId=${currentUser?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-slots/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      
      // Refetch manual para garantir dados atualizados
      refetchTimeSlots();
      refetchAppointments();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover horário",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      if (!currentUser) throw new Error("Usuário não autenticado");

      const response = await apiRequest("DELETE", `/api/appointments/${appointmentId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao excluir agendamento");
      }

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Agendamento cancelado",
        description: "O agendamento foi cancelado com sucesso",
      });

      // Invalidar automaticamente todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-slots/available"] });
      queryClient.invalidateQueries({ queryKey: [`/api/time-slots/embasa?embasaId=${currentUser?.id}`] });
      
      // Refetch manual para garantir dados atualizados
      refetchTimeSlots();
      refetchAppointments();
      setAppointmentToDelete(null);
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar agendamento",
        description: error.message || "Ocorreu um erro ao cancelar o agendamento",
        variant: "destructive",
      });
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await apiRequest("PATCH", `/api/appointments/${appointmentId}/confirm`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao confirmar agendamento");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agendamento confirmado",
        description: "O agendamento foi confirmado com sucesso",
      });
      
      // Invalidar automaticamente todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-slots/available"] });
      queryClient.invalidateQueries({ queryKey: [`/api/time-slots/embasa?embasaId=${currentUser?.id}`] });
      
      // Refetch manual para garantir dados atualizados
      refetchTimeSlots();
      refetchAppointments();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao confirmar agendamento",
        description: error.message || "Ocorreu um erro ao confirmar o agendamento",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSlot = (id: number) => {
    if (confirm("Tem certeza que deseja remover este horário?")) {
      deleteSlotMutation.mutate(id);
    }
  };

  const handleDeleteAppointment = (appointment: AppointmentWithDetails) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmAppointment = (appointmentId: number) => {
    confirmAppointmentMutation.mutate(appointmentId);
  };

  const confirmDeleteAppointment = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete.id);
      setDeleteDialogOpen(false);
    }
  };

  const refreshData = () => {
    refetchTimeSlots();
    refetchAppointments();
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
      const slotsForDay = timeSlots.filter((slot) => slot.date === dateStr);
      const appointmentsForDay = allAppointments.filter(
        (apt) =>
          apt.timeSlot.date === dateStr &&
          apt.timeSlot.embasa.id === currentUser?.id
      );
      days.push({ day, dateStr, slots: slotsForDay, appointments: appointmentsForDay });
    }

    return days;
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr === selectedDate ? null : dateStr);
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Get unique SAC units for filtering from appointments
  const sacUnits = Array.from(new Set(allAppointments.map((apt) => apt.sac.userName)));

  // Filter appointments based on selected SAC unit
  const filteredAppointments =
    filterSac === "all"
      ? allAppointments.filter((apt) => apt.timeSlot.embasa.id === currentUser?.id)
      : allAppointments.filter(
          (apt) =>
            apt.timeSlot.embasa.id === currentUser?.id && apt.sac.userName === filterSac
        );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Disponibilizar Horários
            </h2>
            <div className="flex items-center space-x-4">
              <Button
                onClick={refreshData}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Atualizar Dados</span>
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Filtrar agendamentos por SAC:
                </span>
                <Select value={filterSac} onValueChange={setFilterSac}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sacUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setCreateMultipleSlotsModalOpen(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Criar Múltiplos Horários</span>
              </Button>
              <Button
                onClick={() => setCreateSlotModalOpen(true)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Horário</span>
              </Button>
            </div>
          </div>

          {/* Calendar View */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((dayData, index) => (
                  <div
                    key={index}
                    className={`aspect-square p-2 text-center text-sm border border-gray-200 dark:border-gray-700 rounded ${
                      dayData ? "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" : ""
                    } ${
                      dayData?.slots.length ? "bg-primary-50 dark:bg-primary-900" : ""
                    } ${
                      dayData && selectedDate === dayData.dateStr ? "ring-2 ring-primary-500" : ""
                    }`}
                    onClick={() => dayData && handleDateClick(dayData.dateStr)}
                  >
                    {dayData && (
                      <>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {dayData.day}
                        </div>
                        {dayData.slots.length > 0 && (
                          <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                            {dayData.slots.length} {dayData.slots.length === 1 ? "slot" : "slots"}
                          </div>
                        )}
                        {dayData.appointments.length > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {dayData.appointments.length}{" "}
                            {dayData.appointments.length === 1 ? "agendamento" : "agendamentos"}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Detalhes do dia selecionado */}
              {selectedDate && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">
                    Detalhes de {formatDate(selectedDate)}
                  </h4>

                  {/* Horários disponibilizados nesta data */}
                  {timeSlots.filter((slot) => slot.date === selectedDate).length > 0 ? (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Horários disponibilizados:
                      </h5>
                      <div className="space-y-2">
                        {timeSlots
                          .filter((slot) => slot.date === selectedDate)
                          .map((slot) => (
                            <div
                              key={slot.id}
                              className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center"
                            >
                              <div>
                                <span className="font-medium">
                                  {formatTimeRange(slot.startTime, slot.endTime)}
                                </span>
                                <span className="ml-2 text-gray-600 dark:text-gray-400">
                                  {slot.isAvailable ? "Disponível" : "Ocupado"}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400"
                                disabled={!slot.isAvailable}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Não há horários disponibilizados para esta data.
                    </p>
                  )}

                  {/* Agendamentos nesta data */}
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Agendamentos:
                  </h5>
                  {allAppointments.filter(
                    (apt) =>
                      apt.timeSlot.date === selectedDate &&
                      apt.timeSlot.embasa.id === currentUser?.id
                  ).length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Não há agendamentos para esta data.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {allAppointments
                        .filter(
                          (apt) =>
                            apt.timeSlot.date === selectedDate &&
                            apt.timeSlot.embasa.id === currentUser?.id
                        )
                        .map((apt) => (
                          <div
                            key={apt.id}
                            className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">
                                  {apt.clientName} - SS: {apt.ssNumber}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">
                                  {formatTimeRange(
                                    apt.timeSlot.startTime,
                                    apt.timeSlot.endTime
                                  )}{" "}
                                  • SAC: {apt.sac.userName}
                                </div>
                                {apt.comments && (
                                  <div className="text-gray-500 mt-1">
                                    <span className="font-medium">Comentário:</span> {apt.comments}
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleConfirmAppointment(apt.id)}
                                  className="text-green-600 hover:text-green-900 dark:text-green-400"
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAppointment(apt)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Slots List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Horários Disponibilizados</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchTimeSlots()}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Atualizar horários</span>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Carregando horários...
                  </div>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Nenhum horário disponibilizado
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {timeSlots.map((slot) => (
                    <div key={slot.id} className="py-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                          <Clock className="text-primary-600 dark:text-primary-400 h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(slot.date)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatTimeRange(slot.startTime, slot.endTime)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={slot.isAvailable ? "default" : "secondary"}>
                          {slot.isAvailable ? "Disponível" : "Ocupado"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSlot(slot.id)}
                          disabled={deleteSlotMutation.isPending}
                          className="text-red-600 hover:text-red-900 dark:text-red-400"
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

          {/* Appointments Section with Tabs */}
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Agendamentos Pendentes</span>
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Agendamentos Confirmados</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Histórico Completo</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Agendamentos Pendentes {filterSac !== "all" && `- ${filterSac}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAppointments.filter(apt => !apt.isConfirmed).length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Nenhum agendamento pendente encontrado
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAppointments.filter(apt => !apt.isConfirmed).map((appointment) => (
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
                                {formatDate(appointment.timeSlot.date)} •{" "}
                                {formatTimeRange(
                                  appointment.timeSlot.startTime,
                                  appointment.timeSlot.endTime
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                SAC: {appointment.sac.userName}
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
                              Pendente
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfirmAppointment(appointment.id)}
                              className="text-green-600 hover:text-green-900 border-green-200 hover:border-green-300 hover:bg-green-50"
                              disabled={confirmAppointmentMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Confirmar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAppointment(appointment)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
              <Card>
                <CardHeader>
                  <CardTitle>Agendamentos Confirmados {filterSac !== "all" && `- ${filterSac}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAppointments.filter(apt => apt.isConfirmed).length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Nenhum agendamento confirmado encontrado
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAppointments.filter(apt => apt.isConfirmed).map((appointment) => (
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
                                {formatDate(appointment.timeSlot.date)} •{" "}
                                {formatTimeRange(
                                  appointment.timeSlot.startTime,
                                  appointment.timeSlot.endTime
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                SAC: {appointment.sac.userName}
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
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Confirmado
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAppointment(appointment)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico Completo de Agendamentos {filterSac !== "all" && `- ${filterSac}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        Nenhum agendamento encontrado
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredAppointments
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
                                {formatDate(appointment.timeSlot.date)} •{" "}
                                {formatTimeRange(
                                  appointment.timeSlot.startTime,
                                  appointment.timeSlot.endTime
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                SAC: {appointment.sac.userName}
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
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirmAppointment(appointment.id)}
                                className="text-green-600 hover:text-green-900 border-green-200 hover:border-green-300 hover:bg-green-50"
                                disabled={confirmAppointmentMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirmar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAppointment(appointment)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
          </Tabs>
        </div>
      </main>

      <CreateSlotModal open={createSlotModalOpen} onOpenChange={setCreateSlotModalOpen} />
      <CreateMultipleSlotsModal open={createMultipleSlotsModalOpen} onOpenChange={setCreateMultipleSlotsModalOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o agendamento para {appointmentToDelete?.clientName}?
              <br />
              SS: {appointmentToDelete?.ssNumber}
              <br />
              Data: {appointmentToDelete && formatDate(appointmentToDelete.timeSlot.date)}
              <br />
              Horário:{" "}
              {appointmentToDelete &&
                formatTimeRange(
                  appointmentToDelete.timeSlot.startTime,
                  appointmentToDelete.timeSlot.endTime
                )}
              <br />
              SAC: {appointmentToDelete?.sac.userName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDeleteAppointment}
            >
              Excluir Agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
