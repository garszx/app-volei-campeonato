import { NextResponse } from 'next/server';
import { supabase } from '../../../../supabase'; 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { partidaId, time, valor, valorAbsoluto } = body;

    if (!partidaId || !time || (valor === undefined && valorAbsoluto === undefined)) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const campo = time === 'A' ? 'pontos_a' : 'pontos_b';
    let novoValor = 0;

    // Se o cliente enviar o valor exato já calculado pela interface otimista
    if (valorAbsoluto !== undefined) {
      novoValor = valorAbsoluto;
    } else {
      // Método de fallback (legado)
      const { data: jogo } = await supabase.from('partidas').select('pontos_a, pontos_b').eq('id', partidaId).single();
      if (!jogo) return NextResponse.json({ error: 'Partida não encontrada' }, { status: 404 });
      novoValor = Math.max(0, jogo[campo] + valor);
    }

    const { error: updateError } = await supabase.from('partidas').update({ [campo]: novoValor }).eq('id', partidaId);

    if (updateError) throw updateError;
    return NextResponse.json({ sucesso: true, novoPlacar: novoValor });
    
  } catch (error) {
    console.error("Erro na API de atualizar placar:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}