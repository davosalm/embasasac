import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Clock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/header";
import { CreateSlotModal } from "@/components/modals/create-slot-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { TimeSlot, AppointmentWithDetails } from "@shared/schema";

export default function EmbasaDashboard() {
  const [createSlotModalOpen, setCreateSlotModalOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterSac, setFilterSac] = useState<string>("all");
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: timeSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: [`/api/time-slots/embasa?embasaId=${currentUser?.id}`],
    enabled: !!currentUser,
  });

  const { data: allAppointments = [] } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/time-slots/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Horário removido com sucesso",
        description: "O horário foi excluído do sistema",
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/time-slots/embasa", currentUser!.id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/time-slots/available"] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover horário",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSlot = (id: number) => {
    if (confirm("Tem certeza que deseja remover este horário?")) {
      deleteSlotMutation.mutate(id);
    }
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
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const slotsForDay = timeSlots.filter(slot => slot.date === dateStr);
      days.push({ day, dateStr, slots: slotsForDay });
    }
    
    return days;
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Get unique SAC units for filtering from appointments
  const sacUnits = Array.from(
    new Set(allAppointments.map(apt => apt.sac.userName))
  );

  // Filter appointments based on selected SAC unit
  const filteredAppointments = filterSac === "all" 
    ? allAppointments.filter(apt => apt.timeSlot.embasa.id === currentUser?.id)
    : allAppointments.filter(apt => 
        apt.timeSlot.embasa.id === currentUser?.id && 
        apt.sac.userName === filterSac
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
                    {sacUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setCreateSlotModalOpen(true)}
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
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {weekDays.map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((dayData, index) => (
                  <div
                    key={index}
                    className={`aspect-square p-2 text-center text-sm border border-gray-200 dark:border-gray-700 rounded ${
                      dayData ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : ''
                    } ${
                      dayData?.slots.length ? 'bg-primary-50 dark:bg-primary-900' : ''
                    }`}
                  >
                    {dayData && (
                      <>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {dayData.day}
                        </div>
                        {dayData.slots.length > 0 && (
                          <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                            {dayData.slots.length} {dayData.slots.length === 1 ? 'slot' : 'slots'}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Slots List */}
          <Card>
            <CardHeader>
              <CardTitle>Horários Disponibilizados</CardTitle>
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

          {/* Appointments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Agendamentos {filterSac !== "all" && `- ${filterSac}`}</CardTitle>
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
                  {filteredAppointments.map((appointment) => (
                    <div key={appointment.id} className="py-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <Clock className="text-blue-600 dark:text-blue-400 h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {appointment.clientName} - SS: {appointment.ssNumber}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(appointment.timeSlot.date)} • {formatTimeRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
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
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Agendado
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateSlotModal
        open={createSlotModalOpen}
        onOpenChange={setCreateSlotModalOpen}
      />
    </div>
  );
}
