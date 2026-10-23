import { NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { ref, get, update } from 'firebase/database';
import { TimeDb, Partida } from '../../../../types/torneio';

export async function POST(request: Request) {
  try {
    const { torneioId, acao } = await request.json();
    if (!torneioId || !acao) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    const torneioRef = ref(db, `torneios/${torneioId}`);
    const snapshot = await get(torneioRef);
    if (!snapshot.exists()) return NextResponse.json({ error: 'Torneio não encontrado' }, { status: 404 });

    const dados = snapshot.val();
    const timesClassificacao = Object.values(dados.times || {}) as TimeDb[];
    const partidas = Object.values(dados.partidas || {}) as Partida[];
    const numMatches = partidas.length;
    const updates: Record<string, string | Partida> = {};

    timesClassificacao.sort((a, b) => {
      const isSimples = dados.config?.regras?.sistemaClassificacao !== 'sistema_pontos';
      if (isSimples) {
        if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
      } else {
        if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
      }
      if ((b.sets_average || 0) !== (a.sets_average || 0)) return (b.sets_average || 0) - (a.sets_average || 0);
      if ((b.points_average || 0) !== (a.points_average || 0)) return (b.points_average || 0) - (a.points_average || 0);
      return (b.total_pontos || 0) - (a.total_pontos || 0);
    });

    const isDuasChaves = timesClassificacao.some(t => t.chave === 'A' || t.chave === 'B');

    if (acao === 'gerarSemifinais') {
        if (isDuasChaves) {
            const timesA = timesClassificacao.filter(t => t.chave === 'A'); const timesB = timesClassificacao.filter(t => t.chave === 'B');
            if (timesA.length < 2 || timesB.length < 2) return NextResponse.json({ error: 'Falta times' }, { status: 400 });
            updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesA[0], timeB: timesB[1] };
            updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesB[0], timeB: timesA[1] };
        } else {
            if (timesClassificacao.length < 4) return NextResponse.json({ error: 'Falta times' }, { status: 400 });
            const classificados = timesClassificacao.slice(0, 4);
            updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[3] };
            updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[1], timeB: classificados[2] };
        }
        updates[`torneios/${torneioId}/config/status`] = 'semifinais';
    } 
    else if (acao === 'gerarFinalDireta') {
        const classificados = isDuasChaves ? [timesClassificacao.filter(t => t.chave === 'A')[0], timesClassificacao.filter(t => t.chave === 'B')[0]] : timesClassificacao.slice(0, 2);
        updates[`torneios/${torneioId}/config/status`] = 'finais';
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[1] };
    }
    else if (acao === 'gerarFinais') {
        const semi1 = partidas.find(p => p.id === `jogo_${numMatches - 1}`); 
        const semi2 = partidas.find(p => p.id === `jogo_${numMatches}`);
        if (!semi1 || !semi2) return NextResponse.json({ error: 'Semis não encontradas' }, { status: 400 });
        
        const semi1VenceuA = ((semi1.setsVencidosA || 0) === 2 || (semi1.setsVencidosB || 0) === 2) ? (semi1.setsVencidosA === 2) : (semi1.pontosA > semi1.pontosB);
        const semi2VenceuA = ((semi2.setsVencidosA || 0) === 2 || (semi2.setsVencidosB || 0) === 2) ? (semi2.setsVencidosA === 2) : (semi2.pontosA > semi2.pontosB);
        const vencedor16 = semi1VenceuA ? semi1.timeA : semi1.timeB; const perdedor16 = semi1VenceuA ? semi1.timeB : semi1.timeA;
        const vencedor17 = semi2VenceuA ? semi2.timeA : semi2.timeB; const perdedor17 = semi2VenceuA ? semi2.timeB : semi2.timeA;
        
        updates[`torneios/${torneioId}/config/status`] = 'finais';
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: perdedor16, timeB: perdedor17 };
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: vencedor16, timeB: vencedor17 };
    }
    else if (acao === 'encerrarCampeonatoPontosCorridos') {
        updates[`torneios/${torneioId}/config/status`] = 'finais';
    }

    await update(ref(db), updates);
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro na API de fases:", error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}