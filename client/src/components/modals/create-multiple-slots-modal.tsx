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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ErrorNotification } from "@/components/ui/error-notification";

const createMultipleSlotsSchema = z.object({
  startDate: z.string().min(1, "Data inicial é obrigatória"),
  endDate: z.string().min(1, "Data final é obrigatória"),
  times: z.array(z.string()).min(1, "Selecione pelo menos um horário"),
  daysOfWeek: z.array(z.number()).min(1, "Selecione pelo menos um dia da semana"),
});

type CreateMultipleSlotsForm = z.infer<typeof createMultipleSlotsSchema>;

interface CreateMultipleSlotsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
];

export function CreateMultipleSlotsModal({ open, onOpenChange }: CreateMultipleSlotsModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [times, setTimes] = useState<string[]>(["09:00"]);
  const [newTime, setNewTime] = useState("");

  const form = useForm<CreateMultipleSlotsForm>({
    resolver: zodResolver(createMultipleSlotsSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      times: ["09:00"],
      daysOfWeek: [1, 2, 3, 4, 5], // Segunda a sexta por padrão
    },
  });

  const createSlotsMutation = useMutation({
    mutationFn: async (data: CreateMultipleSlotsForm) => {
      const response = await apiRequest("POST", "/api/time-slots/batch", {
        startDate: data.startDate,
        endDate: data.endDate,
        times: data.times,
        daysOfWeek: data.daysOfWeek,
        embasaCodeId: currentUser!.id,
      });
      
      return response;
    },
    onSuccess: (response) => {
      if (response.status === 201 || response.ok) {
        toast({
          title: "Horários criados com sucesso",
          description: "Os horários foram adicionados ao sistema",
        });
        
        queryClient.invalidateQueries({ 
          queryKey: [`/api/time-slots/embasa?embasaId=${currentUser!.id}`] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/time-slots/available"] 
        });
        
        form.reset();
        setTimes(["09:00"]);
        onOpenChange(false);
        setError(null);
      }
    },
    onError: (error: any) => {
      console.error("Erro na mutação:", error);
      setError(error.message || "Erro interno do servidor");
    },
  });

  const handleAddTime = () => {
    if (newTime && !times.includes(newTime)) {
      const updatedTimes = [...times, newTime];
      setTimes(updatedTimes);
      form.setValue("times", updatedTimes);
      setNewTime("");
    }
  };

  const handleRemoveTime = (index: number) => {
    const updatedTimes = times.filter((_, i) => i !== index);
    setTimes(updatedTimes);
    form.setValue("times", updatedTimes);
  };

  const handleSubmit = (data: CreateMultipleSlotsForm) => {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    
    if (startDate > endDate) {
      setError("A data inicial deve ser anterior à data final");
      return;
    }
    
    createSlotsMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Múltiplos Horários</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inicial</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Final</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Dias da Semana</FormLabel>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={form.watch("daysOfWeek").includes(day.value)}
                        onCheckedChange={(checked) => {
                          const current = form.watch("daysOfWeek");
                          if (checked) {
                            form.setValue("daysOfWeek", [...current, day.value]);
                          } else {
                            form.setValue("daysOfWeek", current.filter(d => d !== day.value));
                          }
                        }}
                      />
                      <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </FormItem>

              <FormItem>
                <FormLabel>Horários</FormLabel>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                    <Button
                      type="button"
                      onClick={handleAddTime}
                      variant="outline"
                    >
                      Adicionar
                    </Button>
                  </div>

                  {times.length > 0 && (
                    <div className="space-y-1">
                      {times.map((time, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <span className="text-sm font-medium">{time}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTime(index)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormItem>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Os horários serão criados para todos os dias 
                  selecionados dentro do período especificado. Cada horário terá duração de 2 horas.
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
                  disabled={createSlotsMutation.isPending}
                >
                  {createSlotsMutation.isPending ? "Criando..." : "Criar Horários"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <ErrorNotification 
        error={error} 
        onClose={() => setError(null)} 
      />
    </>
  );
}
