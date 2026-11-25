export interface Patota {
  id: string;
  slug: string;
  criador_id: string;
  titulo: string;
  local_nome: string;
  local_maps_url?: string | null;
  data_hora: string;
  formato?: string | null;
  nivel?: string | null;
  vagas_total: number;
  valor: number;
  tipo_pagamento?: string | null;
  pix_chave?: string | null;
  pix_titular?: string | null;
  contato_nome?: string | null;
  contato_whatsapp?: string | null;
  mostrar_whatsapp_no_link?: boolean;
  horas_trava_cancelamento?: number;
  status: 'aberta' | 'encerrada' | 'cancelada' | string;
  created_at?: string;
}

export interface PatotaInscricao {
  id: string;
  patota_id: string;
  user_id: string;
  nome_jogador: string;
  whatsapp_jogador?: string | null;
  status_vaga: 'confirmado' | 'espera' | 'cancelado' | string;
  status_pagamento?: 'pendente' | 'aguardando_confirmacao' | 'pago' | string;
  created_at: string;
}