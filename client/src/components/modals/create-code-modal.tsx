import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const createCodeSchema = z.object({
  userType: z.enum(["admin", "embasa", "sac"], {
    required_error: "Selecione o tipo de usuário",
  }),
  userName: z.string().min(1, "Nome é obrigatório"),
  isActive: z.boolean().optional().default(true),
});

type CreateCodeForm = z.infer<typeof createCodeSchema>;

interface CreateCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCodeModal({ open, onOpenChange }: CreateCodeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateCodeForm>({
    resolver: zodResolver(createCodeSchema),
    defaultValues: {
      userType: undefined,
      userName: "",
    },
  });

  const createCodeMutation = useMutation({
    mutationFn: async (data: CreateCodeForm) => {
      const response = await apiRequest("POST", "/api/access-codes", {
        ...data,
        isActive: true,
      });
      return response.json();
    },
    onSuccess: (newCode) => {
      toast({
        title: "Código criado com sucesso",
        description: `Código ${newCode.code} criado para ${newCode.userName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/access-codes"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar código",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateCodeForm) => {
    createCodeMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Código</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Usuário</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="embasa">EMBASA</SelectItem>
                      <SelectItem value="sac">SAC</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome/Identificação</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: EMBASA Federação, SAC Cabula"
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
                disabled={createCodeMutation.isPending}
              >
                {createCodeMutation.isPending ? "Criando..." : "Criar Código"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
