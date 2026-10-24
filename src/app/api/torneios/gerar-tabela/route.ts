import { NextResponse } from 'next/server';
import { supabase } from '../../../../supabase';
import { TimeDb } from '../../../../types/torneio';

export async function POST(request: Request) {
  try {
    const { torneioId } = await request.json();

    if (!torneioId) {
      return NextResponse.json({ error: 'Falta a ID do torneio' }, { status: 400 });
    }

    const { data: torneio } = await supabase.from('torneios').select('regras').eq('id', torneioId).single();
    const { data: times } = await supabase.from('times').select('*').eq('torneio_id', torneioId);

    if (!torneio || !times || times.length < 3) {
      return NextResponse.json({ error: 'Mínimo de 3 times necessários' }, { status: 400 });
    }

    const regras = torneio.regras || {};
    const timesBase = times as TimeDb[];
    
    const isDuasChaves = timesBase.length >= 6;
    const timesSorteados = [...timesBase];
    for (let i = timesSorteados.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [timesSorteados[i], timesSorteados[j]] = [timesSorteados[j], timesSorteados[i]]; 
    }

    // Correção: Uso de PromiseLike para o array de promessas
    const updatesTimes: PromiseLike<unknown>[] = [];
    
    const gerarConfrontos = (grupoTimes: TimeDb[]) => {
        const lista = [...grupoTimes];
        // Correção: Substituição do 'any' por uma conversão segura
        if (lista.length % 2 !== 0) lista.push({ id: 'folga', nome: 'FOLGA' } as unknown as TimeDb);
        const confrontos = [];
        for (let r = 0; r < lista.length - 1; r++) {
            for (let i = 0; i < lista.length / 2; i++) {
                const t1 = lista[i]; const t2 = lista[lista.length - 1 - i];
                if (t1.id !== 'folga' && t2.id !== 'folga') confrontos.push([t1, t2]);
            }
            const ultimo = lista.pop()!; lista.splice(1, 0, ultimo);
        }
        if (regras.turno === 'ida_volta') {
            const tamanho = confrontos.length;
            for(let i=0; i<tamanho; i++) confrontos.push([confrontos[i][1], confrontos[i][0]]);
        }
        return confrontos;
    };

    const confrontosFinais = [];
    
    if (isDuasChaves) {
        const meio = Math.ceil(timesSorteados.length / 2);
        const grupoA = timesSorteados.slice(0, meio); const grupoB = timesSorteados.slice(meio);
        
        // Correção: Adição do .then() para converter o construtor numa Promise nativa
        grupoA.forEach(t => updatesTimes.push(supabase.from('times').update({ chave: 'A' }).eq('id', t.id).then()));
        grupoB.forEach(t => updatesTimes.push(supabase.from('times').update({ chave: 'B' }).eq('id', t.id).then()));
        
        const confA = gerarConfrontos(grupoA); const confB = gerarConfrontos(grupoB);
        const maxLen = Math.max(confA.length, confB.length);
        for(let i=0; i<maxLen; i++){ if(confA[i]) confrontosFinais.push(confA[i]); if(confB[i]) confrontosFinais.push(confB[i]); }
    } else {
        timesSorteados.forEach(t => updatesTimes.push(supabase.from('times').update({ chave: 'U' }).eq('id', t.id).then()));
        confrontosFinais.push(...gerarConfrontos(timesSorteados));
    }

    await Promise.all(updatesTimes);

    const [horaStr, minStr] = (regras.horarioInicio || '08:00').split(':');
    let minAtual = parseInt(horaStr) * 60 + parseInt(minStr);
    
    const novasPartidas = confrontosFinais.map((par, index) => {
        const h = Math.floor(minAtual / 60) % 24; const m = minAtual % 60;
        minAtual += (regras.intervaloMinutos || 45);
        return {
            torneio_id: torneioId,
            fase: 'grupos',
            status: 'pendente',
            horario: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            time_a_id: par[0].id,
            time_b_id: par[1].id,
            ordem: index + 1
        };
    });

    await supabase.from('partidas').insert(novasPartidas);
    await supabase.from('torneios').update({ status: 'fase_grupos' }).eq('id', torneioId);

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro na API de gerar tabela (Supabase):", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}