import { NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { ref, get, update } from 'firebase/database';
import { Partida } from '../../../../types/torneio'; // Importação do tipo adicionada

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { torneioId, partidaId } = body;

    if (!torneioId || !partidaId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const torneioRef = ref(db, `torneios/${torneioId}`);
    const snapshot = await get(torneioRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Torneio não encontrado' }, { status: 404 });
    }

    const dados = snapshot.val();
    const jogo = dados.partidas[partidaId];
    const regras = dados.config.regras;
    const times = dados.times || {};

    // CORREÇÃO 1: Substituímos o 'any' por 'string | number'
    const updates: Record<string, string | number> = {};
    const vencedorA = jogo.pontosA > jogo.pontosB;
    const vencedorB = jogo.pontosB > jogo.pontosA;

    const formatoPartida = jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
    const isMelhorDe3 = formatoPartida?.includes('melhor_de_3');
    let matchFinalizada = false;

    // LÓGICA 1: Calcula quem ganha o set ou a partida
    if (isMelhorDe3) {
      const novosSetsA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0);
      const novosSetsB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0);

      if (novosSetsA === 2 || novosSetsB === 2) {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
        matchFinalizada = true;
      } else {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosA`] = 0;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosB`] = 0;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      }
    } else {
      updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
      matchFinalizada = true;
    }

    await update(ref(db), updates);

    // LÓGICA 2: Se a partida acabou, o servidor recalcula a tabela inteira
    if (matchFinalizada) {
      dados.partidas[partidaId] = {
        ...jogo,
        status: 'finalizado',
        setsVencidosA: updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] ?? jogo.setsVencidosA,
        setsVencidosB: updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] ?? jogo.setsVencidosB
      };

      Object.keys(times).forEach(k => {
        times[k].total_pontos = 0; times[k].pontos_sofridos = 0;
        times[k].sets_vencidos = 0; times[k].sets_perdidos = 0;
        times[k].pontos_classificacao = 0;
      });

      const isMd3Grupos = regras?.formatoGrupos?.includes('melhor_de_3');
      
      // CORREÇÃO 2: Forçamos o tipo para 'Partida' em vez de 'any'
      Object.values(dados.partidas).forEach((p: unknown) => {
        const partida = p as Partida;
        if (partida.fase === 'grupos' && partida.status === 'finalizado') {
          const tA = times[partida.timeA.id]; const tB = times[partida.timeB.id];
          if (!tA || !tB) return;

          tA.total_pontos += partida.pontosA; tA.pontos_sofridos = (tA.pontos_sofridos || 0) + partida.pontosB;
          tB.total_pontos += partida.pontosB; tB.pontos_sofridos = (tB.pontos_sofridos || 0) + partida.pontosA;

          const vA = partida.pontosA > partida.pontosB; const vB = partida.pontosB > partida.pontosA;
          let setsA = partida.setsVencidosA || 0; let setsB = partida.setsVencidosB || 0;
          if (!isMd3Grupos) { setsA = vA ? 1 : 0; setsB = vB ? 1 : 0; }

          tA.sets_vencidos += setsA; tA.sets_perdidos = (tA.sets_perdidos || 0) + setsB;
          tB.sets_vencidos += setsB; tB.sets_perdidos = (tB.sets_perdidos || 0) + setsA;

          if (regras?.sistemaClassificacao === 'sistema_pontos') {
            if (isMd3Grupos) {
              if (setsA === 2 && setsB === 0) { tA.pontos_classificacao += 3; }
              else if (setsB === 2 && setsA === 0) { tB.pontos_classificacao += 3; }
              else if (setsA === 2 && setsB === 1) { tA.pontos_classificacao += 2; tB.pontos_classificacao += 1; }
              else if (setsB === 2 && setsA === 1) { tB.pontos_classificacao += 2; tA.pontos_classificacao += 1; }
            } else {
              if (vA) tA.pontos_classificacao += 3;
              if (vB) tB.pontos_classificacao += 3;
            }
          }
        }
      });

      Object.keys(times).forEach(k => {
        const t = times[k];
        t.sets_average = (t.sets_perdidos || 0) === 0 ? ((t.sets_vencidos || 0) === 0 ? 0 : 999) : ((t.sets_vencidos || 0) / (t.sets_perdidos || 1));
        t.points_average = (t.pontos_sofridos || 0) === 0 ? ((t.total_pontos || 0) === 0 ? 0 : 999) : ((t.total_pontos || 0) / (t.pontos_sofridos || 1));
      });

      await update(ref(db, `torneios/${torneioId}/times`), times);
    }

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro na API de encerrar:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}