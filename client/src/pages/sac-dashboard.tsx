import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { 
    data: availableSlots = [], 
    isLoading: slotsLoading,
    refetch: refetchSlots 
  } = useQuery<TimeSlotWithEmbasa[]>({
    queryKey: ["/api/time-slots/available"],
  });
  
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
        `/api/appointments/${appointmentId}?userId=${currentUser.id}&userType=${currentUser.userType}&userName=${encodeURIComponent(currentUser.userName)}`
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
      
      refetchSlots();
      refetchAppointments();
      setAppointmentToDelete(null);
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

  const refreshData = () => {
    refetchSlots();
    refetchAppointments();
  };

  const handleDeleteAppointment = (appointment: AppointmentWithDetails) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAppointment = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete.id);
      setDeleteDialogOpen(false);
    }
  };

  // Get unique EMBASA units for filtering
  const embasaUnits = Array.from(
    new Set(availableSlots.map(slot => slot.embasa.userName))
  );

  // Filter slots based on selected EMBASA unit
  const filteredSlots = filterEmbasa === "all" 
    ? availableSlots 
    : availableSlots.filter(slot => slot.embasa.userName === filterEmbasa);

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

          {/* Available Appointments */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {slotsLoading ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  Carregando horários disponíveis...
                </div>
              </div>
            ) : filteredSlots.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  Nenhum horário disponível no momento
                </div>
              </div>
            ) : (
              filteredSlots.map((slot) => (
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

          {/* My Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Meus Agendamentos</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshData}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Atualizar</span>
              </Button>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Carregando agendamentos...
                  </div>
                </div>
              ) : myAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">
                    Você não possui agendamentos
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {myAppointments.map((appointment) => (
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
                            {appointment.timeSlot.embasa.userName}
                          </div>
                          {appointment.comments && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Comentários: {appointment.comments}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Badge className="mr-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Agendado
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
