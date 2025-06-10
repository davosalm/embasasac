import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { TimeSlotWithEmbasa } from "@shared/schema";

const bookingSchema = z.object({
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  ssNumber: z.string().min(1, "Número da SS é obrigatório"),
  comments: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeSlot: TimeSlotWithEmbasa | null;
}

export function BookingModal({ open, onOpenChange, timeSlot }: BookingModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      clientName: "",
      ssNumber: "",
      comments: "",
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingForm) => {
      const response = await apiRequest("POST", "/api/appointments", {
        ...data,
        timeSlotId: timeSlot!.id,
        sacCodeId: currentUser!.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agendamento realizado com sucesso",
        description: "Sua visita técnica foi agendada",
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/time-slots/available"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/appointments/sac", currentUser!.id] 
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao realizar agendamento",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: BookingForm) => {
    if (!timeSlot) return;
    bookingMutation.mutate(data);
  };

  if (!timeSlot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Visita Técnica</DialogTitle>
        </DialogHeader>

        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Horário selecionado:
          </div>
          <div className="font-medium text-gray-900 dark:text-white">
            {formatDate(timeSlot.date)} - {formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {timeSlot.embasa.userName}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente *</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ssNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da SS *</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o número da SS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentários</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais (opcional)"
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={bookingMutation.isPending}
              >
                {bookingMutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
