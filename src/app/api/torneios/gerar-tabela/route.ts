import { NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { ref, get, update, set } from 'firebase/database';
import { Time, Partida } from '../../../../types/torneio';

export async function POST(request: Request) {
  try {
    const { torneioId } = await request.json();

    if (!torneioId) {
      return NextResponse.json({ error: 'Falta a ID do torneio' }, { status: 400 });
    }

    const torneioRef = ref(db, `torneios/${torneioId}`);
    const snapshot = await get(torneioRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Torneio não encontrado' }, { status: 404 });
    }

    const dados = snapshot.val();
    const timesBase = Object.values(dados.times || {}) as Time[];
    const regras = dados.config?.regras;

    if (timesBase.length < 3) {
      return NextResponse.json({ error: 'Mínimo de 3 times necessários' }, { status: 400 });
    }

    const isDuasChaves = timesBase.length >= 6;
    const timesSorteados = [...timesBase];
    for (let i = timesSorteados.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [timesSorteados[i], timesSorteados[j]] = [timesSorteados[j], timesSorteados[i]]; 
    }

    const updates: Record<string, string> = {};
    
    const gerarConfrontos = (grupoTimes: Time[]) => {
        const lista = [...grupoTimes];
        if (lista.length % 2 !== 0) lista.push({ id: 'folga_ficticia', nome: 'FOLGA', escudoUrl: '' });
        const confrontos = [];
        for (let r = 0; r < lista.length - 1; r++) {
            for (let i = 0; i < lista.length / 2; i++) {
                const t1 = lista[i]; const t2 = lista[lista.length - 1 - i];
                if (t1.id !== 'folga_ficticia' && t2.id !== 'folga_ficticia') confrontos.push([t1, t2]);
            }
            const ultimo = lista.pop()!; lista.splice(1, 0, ultimo);
        }
        if (regras?.turno === 'ida_volta') {
            const tamanho = confrontos.length;
            for(let i=0; i<tamanho; i++) confrontos.push([confrontos[i][1], confrontos[i][0]]);
        }
        return confrontos;
    };

    const confrontosFinais = [];
    if (isDuasChaves) {
        const meio = Math.ceil(timesSorteados.length / 2);
        const grupoA = timesSorteados.slice(0, meio); const grupoB = timesSorteados.slice(meio);
        grupoA.forEach(t => updates[`torneios/${torneioId}/times/${t.id}/chave`] = 'A');
        grupoB.forEach(t => updates[`torneios/${torneioId}/times/${t.id}/chave`] = 'B');
        const confA = gerarConfrontos(grupoA); const confB = gerarConfrontos(grupoB);
        const maxLen = Math.max(confA.length, confB.length);
        for(let i=0; i<maxLen; i++){ if(confA[i]) confrontosFinais.push(confA[i]); if(confB[i]) confrontosFinais.push(confB[i]); }
    } else {
        timesSorteados.forEach(t => updates[`torneios/${torneioId}/times/${t.id}/chave`] = 'U');
        confrontosFinais.push(...gerarConfrontos(timesSorteados));
    }
    
    const novasPartidas: Record<string, Partida> = {};
    const [horaStr, minStr] = (regras?.horarioInicio || '08:00').split(':');
    let minAtual = parseInt(horaStr) * 60 + parseInt(minStr);
    
    confrontosFinais.forEach((par, index) => {
        const h = Math.floor(minAtual / 60) % 24; const m = minAtual % 60;
        novasPartidas[`jogo_${index + 1}`] = {
            id: `jogo_${index + 1}`, fase: 'grupos', horario: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, status: 'pendente',
            pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: par[0] as Time, timeB: par[1] as Time
        };
        minAtual += (regras?.intervaloMinutos || 45);
    });

    updates[`torneios/${torneioId}/config/status`] = 'fase_grupos';
    await update(ref(db), updates); 
    await set(ref(db, `torneios/${torneioId}/partidas`), novasPartidas);

    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro na API de gerar tabela:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}