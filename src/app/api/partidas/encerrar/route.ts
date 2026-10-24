import { NextResponse } from 'next/server';
import { supabase } from '../../../../supabase';
import { Partida, TimeDb } from '../../../../types/torneio';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { torneioId, partidaId } = body;

    if (!torneioId || !partidaId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const { data: torneio } = await supabase.from('torneios').select('regras').eq('id', torneioId).single();
    const { data: jogo } = await supabase.from('partidas').select('*').eq('id', partidaId).single();

    if (!torneio || !jogo) {
      return NextResponse.json({ error: 'Dados não encontrados' }, { status: 404 });
    }

    if (jogo.status === 'finalizado') {
       return NextResponse.json({ sucesso: true, aviso: 'Já finalizado' });
    }

    const regras = torneio.regras || {};
    const vencedorA = jogo.pontos_a > jogo.pontos_b;
    const vencedorB = jogo.pontos_b > jogo.pontos_a;

    const formatoPartida = jogo.fase === 'grupos' ? regras.formatoGrupos : regras.formatoFinais;
    const isMelhorDe3 = formatoPartida?.includes('melhor_de_3');
    
    let matchFinalizada = false;
    let novosSetsA = jogo.sets_vencidos_a || 0;
    let novosSetsB = jogo.sets_vencidos_b || 0;
    let novosPontosA = jogo.pontos_a;
    let novosPontosB = jogo.pontos_b;
    let novoStatus = jogo.status;

    if (isMelhorDe3) {
      if (vencedorA) novosSetsA += 1;
      if (vencedorB) novosSetsB += 1;

      if (novosSetsA === 2 || novosSetsB === 2) {
        novoStatus = 'finalizado';
        matchFinalizada = true;
      } else {
        novosPontosA = 0;
        novosPontosB = 0;
      }
    } else {
      novoStatus = 'finalizado';
      matchFinalizada = true;
      if (vencedorA) novosSetsA += 1;
      if (vencedorB) novosSetsB += 1;
    }

    await supabase.from('partidas').update({
      status: novoStatus,
      pontos_a: novosPontosA,
      pontos_b: novosPontosB,
      sets_vencidos_a: novosSetsA,
      sets_vencidos_b: novosSetsB
    }).eq('id', partidaId);

    if (matchFinalizada && jogo.fase === 'grupos') {
      const { data: timesData } = await supabase.from('times').select('*').eq('torneio_id', torneioId);
      const { data: partidasData } = await supabase.from('partidas').select('*').eq('torneio_id', torneioId);

      if (timesData && partidasData) {
        const timesMap: Record<string, TimeDb> = {};
        timesData.forEach(t => {
          timesMap[t.id] = { ...t, total_pontos: 0, pontos_sofridos: 0, sets_vencidos: 0, sets_perdidos: 0, pontos_classificacao: 0 } as TimeDb;
        });

        const isMd3Grupos = regras.formatoGrupos?.includes('melhor_de_3');

        partidasData.forEach((pRaw: unknown) => {
          const p = pRaw as Partida & { pontos_a: number; pontos_b: number; sets_vencidos_a: number; sets_vencidos_b: number; time_a_id: string; time_b_id: string };
          const match = p.id === partidaId ? { ...p, status: novoStatus, pontos_a: novosPontosA, pontos_b: novosPontosB, sets_vencidos_a: novosSetsA, sets_vencidos_b: novosSetsB } : p;

          if (match.fase === 'grupos' && match.status === 'finalizado') {
            const tA = timesMap[match.time_a_id];
            const tB = timesMap[match.time_b_id];
            if (!tA || !tB) return;

            tA.total_pontos = (tA.total_pontos || 0) + match.pontos_a;
            tA.pontos_sofridos = (tA.pontos_sofridos || 0) + match.pontos_b;
            tB.total_pontos = (tB.total_pontos || 0) + match.pontos_b;
            tB.pontos_sofridos = (tB.pontos_sofridos || 0) + match.pontos_a;

            const sA = match.sets_vencidos_a || 0;
            const sB = match.sets_vencidos_b || 0;
            tA.sets_vencidos = (tA.sets_vencidos || 0) + sA;
            tA.sets_perdidos = (tA.sets_perdidos || 0) + sB;
            tB.sets_vencidos = (tB.sets_vencidos || 0) + sB;
            tB.sets_perdidos = (tB.sets_perdidos || 0) + sA;

            const vitoriaEquipaA = sA > sB;
            const vitoriaEquipaB = sB > sA;

            if (regras.sistemaClassificacao === 'sistema_pontos') {
              if (isMd3Grupos) {
                if (sA === 2 && sB === 0) { tA.pontos_classificacao = (tA.pontos_classificacao || 0) + 3; }
                else if (sB === 2 && sA === 0) { tB.pontos_classificacao = (tB.pontos_classificacao || 0) + 3; }
                else if (sA === 2 && sB === 1) { 
                    tA.pontos_classificacao = (tA.pontos_classificacao || 0) + 2; 
                    tB.pontos_classificacao = (tB.pontos_classificacao || 0) + 1; 
                }
                else if (sB === 2 && sA === 1) { 
                    tB.pontos_classificacao = (tB.pontos_classificacao || 0) + 2; 
                    tA.pontos_classificacao = (tA.pontos_classificacao || 0) + 1; 
                }
              } else {
                if (vitoriaEquipaA) tA.pontos_classificacao = (tA.pontos_classificacao || 0) + 3;
                if (vitoriaEquipaB) tB.pontos_classificacao = (tB.pontos_classificacao || 0) + 3;
              }
            } else {
              if (vitoriaEquipaA) tA.pontos_classificacao = (tA.pontos_classificacao || 0) + 1;
              if (vitoriaEquipaB) tB.pontos_classificacao = (tB.pontos_classificacao || 0) + 1;
            }
          }
        });

        const updatesTimes = Object.values(timesMap).map(t => {
          const sets_average = (t.sets_perdidos || 0) === 0 ? ((t.sets_vencidos || 0) === 0 ? 0 : 999) : ((t.sets_vencidos || 0) / (t.sets_perdidos || 1));
          const points_average = (t.pontos_sofridos || 0) === 0 ? ((t.total_pontos || 0) === 0 ? 0 : 999) : ((t.total_pontos || 0) / (t.pontos_sofridos || 1));

          return supabase.from('times').update({
            total_pontos: t.total_pontos, pontos_sofridos: t.pontos_sofridos,
            sets_vencidos: t.sets_vencidos, sets_perdidos: t.sets_perdidos,
            pontos_classificacao: t.pontos_classificacao,
            sets_average, points_average
          }).eq('id', t.id);
        });

        await Promise.all(updatesTimes);
      }
    }

    return NextResponse.json({ sucesso: true, statusFinal: novoStatus });
  } catch (error) {
    console.error("Erro na API de encerrar:", error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}