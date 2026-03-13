import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ErrorNotification } from "@/components/ui/error-notification";

const createSlotsSchema = z.object({
  dates: z.array(z.string()).min(1, "Selecione pelo menos uma data"),
  times: z.array(z.string()).min(1, "Selecione pelo menos um horário"),
});

type CreateSlotsForm = z.infer<typeof createSlotsSchema>;

interface CreateSlotsSimplifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIXED_TIMES = [
  { value: "09:00", label: "09:00 - 11:00" },
  { value: "14:00", label: "14:00 - 16:00" },
];

interface DatesByMonth {
  [key: string]: Array<{ dateStr: string; dayName: string }>;
}

export function CreateSlotsSimplifiedModal({ open, onOpenChange }: CreateSlotsSimplifiedModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  const form = useForm<CreateSlotsForm>({
    resolver: zodResolver(createSlotsSchema),
    defaultValues: {
      dates: [],
      times: ["09:00", "14:00"],
    },
  });

  const createSlotsMutation = useMutation({
    mutationFn: async (data: CreateSlotsForm) => {
      const createdSlots = [];
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      let successCount = 0;
      let errorCount = 0;

      for (const date of data.dates) {
        for (const time of data.times) {
          try {
            const response = await apiRequest("POST", "/api/time-slots", {
              date,
              startTime: time,
            });

            if (!response.ok) {
              errorCount++;
              console.error(`Erro ao criar horário para ${date} às ${time}`);
            } else {
              const slot = await response.json();
              createdSlots.push(slot);
              successCount++;
            }

            // Add delay between requests to avoid server overload
            await delay(150);
          } catch (error) {
            errorCount++;
            console.error(`Erro ao criar horário para ${date} às ${time}:`, error);
          }
        }
      }

      if (successCount === 0) {
        throw new Error("Nenhum horário foi criado. Verifique os dados e tente novamente.");
      }

      return { createdSlots, successCount, errorCount };
    },
    onSuccess: (result) => {
      const { successCount, errorCount } = result;
      
      if (errorCount > 0) {
        toast({
          title: "Criação parcial",
          description: `${successCount} horários criados com sucesso. ${errorCount} falharam.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Horários criados com sucesso",
          description: `${successCount} horários foram adicionados ao sistema`,
        });
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/time-slots/embasa?embasaId=${currentUser!.id}`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/time-slots/available"],
      });

      form.reset();
      setSelectedDates([]);
      onOpenChange(false);
      setError(null);
    },
    onError: (error: any) => {
      console.error("Erro na mutação:", error);
      setError(error.message || "Erro interno do servidor");
    },
  });

  const handleDateToggle = (date: string) => {
    const newDates = selectedDates.includes(date)
      ? selectedDates.filter(d => d !== date)
      : [...selectedDates, date];

    setSelectedDates(newDates);
    form.setValue("dates", newDates);
  };

  const handleTimeToggle = (time: string) => {
    const current = form.watch("times");
    const newTimes = current.includes(time)
      ? current.filter(t => t !== time)
      : [...current, time];

    form.setValue("times", newTimes);
  };

  const handleSubmit = (data: CreateSlotsForm) => {
    createSlotsMutation.mutate(data);
  };

  // Generate next 3 months of dates organized by month
  const generateDatesByMonth = (): DatesByMonth => {
    const datesByMonth: DatesByMonth = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate dates for next 3 months
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const currentDate = new Date(today);
      currentDate.setMonth(currentDate.getMonth() + monthOffset);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

      if (!datesByMonth[monthKey]) {
        datesByMonth[monthKey] = [];
      }

      // Get last day of month
      const lastDay = new Date(year, month + 1, 0).getDate();

      // Start from today if it's the current month, otherwise from day 1
      const startDay = monthOffset === 0 ? today.getDate() : 1;

      for (let day = startDay; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = date.toISOString().split("T")[0];
        const dayName = date.toLocaleDateString("pt-BR", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        datesByMonth[monthKey].push({ dateStr, dayName });
      }
    }

    return datesByMonth;
  };

  const datesByMonth = generateDatesByMonth();
  const times = form.watch("times");

  const monthNames: { [key: string]: string } = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Disponibilizar Horários</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Horários Fixos */}
              <FormItem>
                <FormLabel>Horários Disponíveis</FormLabel>
                <div className="space-y-2">
                  {FIXED_TIMES.map((slot) => (
                    <div key={slot.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`time-${slot.value}`}
                        checked={times.includes(slot.value)}
                        onCheckedChange={() => handleTimeToggle(slot.value)}
                      />
                      <label
                        htmlFor={`time-${slot.value}`}
                        className="text-sm cursor-pointer font-medium"
                      >
                        {slot.label}
                      </label>
                    </div>
                  ))}
                </div>
              </FormItem>

              {/* Datas por Mês */}
              <FormItem>
                <FormLabel>Selecione as Datas (próximos 3 meses - dias úteis)</FormLabel>
                <div className="space-y-4 max-h-64 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded">
                  {Object.entries(datesByMonth).map(([monthKey, dates]) => {
                    const [year, month] = monthKey.split("-");
                    const monthName = monthNames[month];

                    return (
                      <div key={monthKey} className="space-y-2">
                        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                          {monthName} {year}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          {dates.map((day) => (
                            <div
                              key={day.dateStr}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`date-${day.dateStr}`}
                                checked={selectedDates.includes(day.dateStr)}
                                onCheckedChange={() =>
                                  handleDateToggle(day.dateStr)
                                }
                              />
                              <label
                                htmlFor={`date-${day.dateStr}`}
                                className="text-sm cursor-pointer"
                              >
                                {day.dayName}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Resumo:</strong> Você está criando {selectedDates.length} datas × {times.length} horários = {selectedDates.length * times.length} agendamentos
                </AlertDescription>
              </Alert>

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
                  disabled={
                    createSlotsMutation.isPending ||
                    selectedDates.length === 0 ||
                    times.length === 0
                  }
                >
                  {createSlotsMutation.isPending ? "Criando..." : "Criar Horários"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ErrorNotification error={error} onClose={() => setError(null)} />
    </>
  );
}
