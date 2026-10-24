export interface Regras {
  formatoGrupos?: string;
  formatoFinais?: string;
  sistemaClassificacao?: string;
  mostrarLogos?: boolean;
  senhaAdmin?: string;
  nomeCampeonato?: string;
}

export interface Time {
  id: string;
  nome: string;
  escudoUrl: string;
  chave?: string;
}

export interface TimeDb extends Time {
  escudo_url: string;
  total_pontos?: number;
  pontos_sofridos?: number;
  sets_vencidos?: number;
  sets_perdidos?: number;
  pontos_classificacao?: number;
  sets_average?: number;
  points_average?: number;
  vitorias_calculadas?: number;
}

export interface Partida {
  id: string;
  numero?: number;
  ordem?: number;
  fase: string;
  status: string;
  horario: string;
  pontosA: number;
  pontosB: number;
  setsVencidosA?: number;
  setsVencidosB?: number;
  parciais?: string;
  timeA: Time | TimeDb;
  timeB: Time | TimeDb;
  
  
  time_a_id?: string;
  time_b_id?: string;
  pontos_a?: number;
  pontos_b?: number;
  sets_vencidos_a?: number;
  sets_vencidos_b?: number;
}