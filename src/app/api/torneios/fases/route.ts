import { NextResponse } from 'next/server';
import { supabase } from '../../../../supabase';
import { TimeDb } from '../../../../types/torneio';

export async function POST(request: Request) {
  try {
    const { torneioId, acao } = await request.json();
    if (!torneioId || !acao) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });

    // 1. Busca todos os dados relacionais necessários
    const { data: torneio } = await supabase.from('torneios').select('*').eq('id', torneioId).single();
    const { data: times } = await supabase.from('times').select('*').eq('torneio_id', torneioId);
    const { data: partidas } = await supabase.from('partidas').select('*').eq('torneio_id', torneioId);

    if (!torneio || !times || !partidas) return NextResponse.json({ error: 'Dados não encontrados' }, { status: 404 });

    const timesClassificacao = times as TimeDb[];
    const numMatches = partidas.length;

    // 2. Ordena a classificação oficial
    timesClassificacao.sort((a, b) => {
      const isSimples = torneio.regras?.sistemaClassificacao !== 'sistema_pontos';
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
    const novasPartidas = [];
    let novoStatus = torneio.status;

    // 3. Aplica a lógica dependendo da ação solicitada
    if (acao === 'gerarSemifinais') {
        if (isDuasChaves) {
            const timesA = timesClassificacao.filter(t => t.chave === 'A'); const timesB = timesClassificacao.filter(t => t.chave === 'B');
            novasPartidas.push({ torneio_id: torneioId, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', time_a_id: timesA[0].id, time_b_id: timesB[1].id, ordem: numMatches + 1 });
            novasPartidas.push({ torneio_id: torneioId, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', time_a_id: timesB[0].id, time_b_id: timesA[1].id, ordem: numMatches + 2 });
        } else {
            const classificados = timesClassificacao.slice(0, 4);
            novasPartidas.push({ torneio_id: torneioId, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', time_a_id: classificados[0].id, time_b_id: classificados[3].id, ordem: numMatches + 1 });
            novasPartidas.push({ torneio_id: torneioId, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', time_a_id: classificados[1].id, time_b_id: classificados[2].id, ordem: numMatches + 2 });
        }
        novoStatus = 'semifinais';
    } 
    else if (acao === 'gerarFinalDireta') {
        const classificados = isDuasChaves ? [timesClassificacao.filter(t => t.chave === 'A')[0], timesClassificacao.filter(t => t.chave === 'B')[0]] : timesClassificacao.slice(0, 2);
        novoStatus = 'finais';
        novasPartidas.push({ torneio_id: torneioId, fase: 'final', horario: 'FINAL', status: 'pendente', time_a_id: classificados[0].id, time_b_id: classificados[1].id, ordem: numMatches + 1 });
    }
    else if (acao === 'gerarFinais') {
        // Encontra as meias-finais e ordena-as para descobrir os cruzamentos
        const semis = partidas.filter(p => p.fase === 'semifinal').sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        const semi1 = semis[0]; const semi2 = semis[1];
        
        const semi1VenceuA = ((semi1.sets_vencidos_a || 0) === 2 || (semi1.sets_vencidos_b || 0) === 2) ? (semi1.sets_vencidos_a === 2) : (semi1.pontos_a > semi1.pontos_b);
        const semi2VenceuA = ((semi2.sets_vencidos_a || 0) === 2 || (semi2.sets_vencidos_b || 0) === 2) ? (semi2.sets_vencidos_a === 2) : (semi2.pontos_a > semi2.pontos_b);
        
        const vencedor16 = semi1VenceuA ? semi1.time_a_id : semi1.time_b_id; const perdedor16 = semi1VenceuA ? semi1.time_b_id : semi1.time_a_id;
        const vencedor17 = semi2VenceuA ? semi2.time_a_id : semi2.time_b_id; const perdedor17 = semi2VenceuA ? semi2.time_b_id : semi2.time_a_id;
        
        novoStatus = 'finais';
        novasPartidas.push({ torneio_id: torneioId, fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente', time_a_id: perdedor16, time_b_id: perdedor17, ordem: numMatches + 1 });
        novasPartidas.push({ torneio_id: torneioId, fase: 'final', horario: 'FINAL', status: 'pendente', time_a_id: vencedor16, time_b_id: vencedor17, ordem: numMatches + 2 });
    }
    else if (acao === 'encerrarCampeonatoPontosCorridos') {
        novoStatus = 'finais';
    }

    // 4. Guarda tudo no banco de dados de uma só vez
    if (novasPartidas.length > 0) {
        await supabase.from('partidas').insert(novasPartidas);
    }
    await supabase.from('torneios').update({ status: novoStatus }).eq('id', torneioId);

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro na API de fases (Supabase):", error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}