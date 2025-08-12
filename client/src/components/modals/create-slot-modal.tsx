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
import { Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ErrorNotification } from "@/components/ui/error-notification";

const createSlotSchema = z.object({
  date: z.string().min(1, "Data é obrigatória").refine((date) => {
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = domingo, 6 = sábado
  }, "Não é possível criar horários aos sábados e domingos"),
  startTime: z.string().min(1, "Horário é obrigatório"),
});

type CreateSlotForm = z.infer<typeof createSlotSchema>;

interface CreateSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSlotModal({ open, onOpenChange }: CreateSlotModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateSlotForm>({
    resolver: zodResolver(createSlotSchema),
    defaultValues: {
      date: "",
      startTime: "",
    },
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: CreateSlotForm) => {
      const response = await apiRequest("POST", "/api/time-slots", {
        ...data,
        embasaCodeId: currentUser!.id,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao criar horário");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Horário disponibilizado com sucesso",
        description: "O horário foi adicionado ao sistema",
      });
      // Invalidar automaticamente todas as queries relacionadas
      queryClient.invalidateQueries({ 
        queryKey: [`/api/time-slots/embasa?embasaId=${currentUser!.id}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/time-slots/available"] 
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      setError(error.message || "Erro interno do servidor");
    },
  });

  const handleSubmit = (data: CreateSlotForm) => {
    createSlotMutation.mutate(data);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disponibilizar Horário</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Início</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> O horário será automaticamente 
                  definido com duração de 2 horas a partir do horário de início informado.
                  <br />
                  <strong>Nota:</strong> Não é possível criar horários aos sábados e domingos.
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
                  disabled={createSlotMutation.isPending}
                >
                  {createSlotMutation.isPending ? "Criando..." : "Disponibilizar"}
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
