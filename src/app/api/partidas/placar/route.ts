import { NextResponse } from 'next/server';
import { db } from '../../../../firebase'; 
import { ref, get, update } from 'firebase/database';

export async function POST(request: Request) {
  try {
    // Lê o que o botão do front-end enviou
    const body = await request.json();
    const { torneioId, partidaId, time, valor } = body;

    if (!torneioId || !partidaId || !time || valor === undefined) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const partidaRef = ref(db, `torneios/${torneioId}/partidas/${partidaId}`);
    const snapshot = await get(partidaRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Partida não encontrada' }, { status: 404 });
    }

    // Matemática feita no servidor, não no celular do usuário
    const jogo = snapshot.val();
    const campo = time === 'A' ? 'pontosA' : 'pontosB';
    let novoValor = jogo[campo] + valor;
    if (novoValor < 0) novoValor = 0;

    // Salva no banco
    await update(partidaRef, { [campo]: novoValor });

    return NextResponse.json({ sucesso: true, novoPlacar: novoValor });
    
  } catch (error) {
    console.error("Erro na API de atualizar placar:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}