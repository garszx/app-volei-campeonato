export interface Time { 
  id: string; 
  nome: string; 
  escudoUrl: string; 
}

export interface TimeDb { 
  id: string; 
  nome: string; 
  escudoUrl: string; 
  chave?: string; 
  sets_vencidos: number; 
  sets_perdidos?: number; 
  total_pontos: number; 
  pontos_sofridos?: number; 
  pontos_classificacao: number; 
  sets_average?: number; 
  points_average?: number; 
}

export interface Partida { 
  id: string; 
  fase: string; 
  horario: string; 
  status: string; 
  pontosA: number; 
  pontosB: number; 
  setsVencidosA?: number; 
  setsVencidosB?: number; 
  timeA: Time; 
  timeB: Time; 
}

export interface Regras { 
  nomeCampeonato: string; 
  mostrarLogos: boolean; 
  horarioInicio: string; 
  intervaloMinutos: number; 
  formatoGrupos: string; 
  formatoFinais: string; 
  sistemaClassificacao: string; 
  turno: string; 
  senhaAdmin?: string; 
}