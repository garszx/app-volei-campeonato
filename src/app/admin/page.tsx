// app/admin/page.tsx
"use client";

import { useEffect, useState, FormEvent } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update } from 'firebase/database';
import styles from './admin.module.css';

interface TimeDb {
  id: string;
  nome: string;
  escudoUrl: string;
  sets_vencidos: number;
  total_pontos: number;
}

interface TimeDaPartida {
  id: string;
  nome: string;
  escudoUrl: string;
}

interface Partida {
  id: string;
  fase: string;
  horario: string;
  status: string;
  pontosA: number;
  pontosB: number;
  timeA: TimeDaPartida;
  timeB: TimeDaPartida;
}

export default function PainelAdmin() {
  const [senha, setSenha] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});
  const [statusTorneio, setStatusTorneio] = useState<string>('');

  useEffect(() => {
    if (!autenticado) return;

    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || '');
        setTimesMap(data.times || {});
        if (data.partidas) {
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => a.horario.localeCompare(b.horario));
          setPartidas(partidasArray);
        }
      }
    });

    return () => unsubscribe();
  }, [autenticado]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (senha === 'volei2026') {
      setAutenticado(true);
    } else {
      alert('Senha incorreta');
    }
  };

  const iniciarPartida = async (id: string) => {
    await update(ref(db, `torneio/partidas/${id}`), { status: 'em_andamento' });
  };

  const atualizarPlacar = async (id: string, time: 'A' | 'B', valor: number) => {
    const jogo = partidas.find(p => p.id === id);
    if (!jogo) return;

    const campo = time === 'A' ? 'pontosA' : 'pontosB';
    let novoValor = jogo[campo] + valor;
    if (novoValor < 0) novoValor = 0;

    await update(ref(db, `torneio/partidas/${id}`), { [campo]: novoValor });
  };

  const encerrarPartida = async (jogo: Partida) => {
    if (jogo.pontosA < 25 && jogo.pontosB < 25) {
      if (!confirm("Nenhum time atingiu 25 pontos. Encerrar mesmo assim?")) return;
    }

    const updates: Record<string, string | number> = {};
    updates[`torneio/partidas/${jogo.id}/status`] = 'finalizado';

    const timeA_db = timesMap[jogo.timeA.id];
    const timeB_db = timesMap[jogo.timeB.id];

    if (timeA_db && timeB_db) {
      const vencedorA = jogo.pontosA > jogo.pontosB;
      const vencedorB = jogo.pontosB > jogo.pontosA;

      updates[`torneio/times/${jogo.timeA.id}/total_pontos`] = timeA_db.total_pontos + jogo.pontosA;
      updates[`torneio/times/${jogo.timeA.id}/sets_vencidos`] = timeA_db.sets_vencidos + (vencedorA ? 1 : 0);

      updates[`torneio/times/${jogo.timeB.id}/total_pontos`] = timeB_db.total_pontos + jogo.pontosB;
      updates[`torneio/times/${jogo.timeB.id}/sets_vencidos`] = timeB_db.sets_vencidos + (vencedorB ? 1 : 0);
    }

    await update(ref(db), updates);
  };

  const gerarSemifinais = async () => {
    if (!confirm("Confirmar o encerramento da fase de grupos e gerar as Semifinais?")) return;

    const timesArray = Object.values(timesMap);
    
    // Reproduz a exata mesma lógica de classificação para pegar os 4 melhores
    timesArray.sort((a, b) => {
      if (b.sets_vencidos !== a.sets_vencidos) {
        return b.sets_vencidos - a.sets_vencidos;
      }
      return b.total_pontos - a.total_pontos;
    });

    const classificados = timesArray.slice(0, 4);
    const updates: Record<string, string | Partida> = {};

    // Altera o status do campeonato
    updates['torneio/config/status'] = 'semifinais';

    // Cria a Semifinal 1 (1º Colocado x 4º Colocado)
    updates['torneio/partidas/jogo_16'] = {
      id: 'jogo_16',
      fase: 'semifinal',
      horario: '15:00',
      status: 'pendente',
      pontosA: 0,
      pontosB: 0,
      timeA: { id: classificados[0].id, nome: classificados[0].nome, escudoUrl: classificados[0].escudoUrl },
      timeB: { id: classificados[3].id, nome: classificados[3].nome, escudoUrl: classificados[3].escudoUrl }
    };

    // Cria a Semifinal 2 (2º Colocado x 3º Colocado)
    updates['torneio/partidas/jogo_17'] = {
      id: 'jogo_17',
      fase: 'semifinal',
      horario: '15:30',
      status: 'pendente',
      pontosA: 0,
      pontosB: 0,
      timeA: { id: classificados[1].id, nome: classificados[1].nome, escudoUrl: classificados[1].escudoUrl },
      timeB: { id: classificados[2].id, nome: classificados[2].nome, escudoUrl: classificados[2].escudoUrl }
    };

    await update(ref(db), updates);
  };

  if (!autenticado) {
    return (
      <div className={styles.container}>
        <form onSubmit={handleLogin} className={styles.loginBox}>
          <h2>Painel de Controle do Placar</h2>
          <input
            type="password"
            placeholder="Digite a senha"
            className={styles.input}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="submit" className={styles.btnPrimary}>Acessar</button>
        </form>
      </div>
    );
  }

  const jogoAtual = partidas.find(p => p.status === 'em_andamento');
  const proximoJogo = partidas.find(p => p.status === 'pendente');

  return (
    <div className={styles.container}>
      <h1>Controle de Jogo</h1>

      {jogoAtual ? (
        <div className={styles.card}>
          <h2 style={{ color: 'var(--btn-bg)' }}>Jogo em Andamento - {jogoAtual.horario}</h2>
          
          <div className={styles.scoreBoard}>
            <div className={styles.teamCol}>
              <h3>{jogoAtual.timeA.nome}</h3>
              <span className={styles.scoreText}>{jogoAtual.pontosA}</span>
              <div className={styles.controls}>
                <button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', -1)}>-</button>
                <button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', 1)}>+</button>
              </div>
            </div>

            <h2>X</h2>

            <div className={styles.teamCol}>
              <h3>{jogoAtual.timeB.nome}</h3>
              <span className={styles.scoreText}>{jogoAtual.pontosB}</span>
              <div className={styles.controls}>
                <button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', -1)}>-</button>
                <button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', 1)}>+</button>
              </div>
            </div>
          </div>

          <button 
            className={styles.btnEnd} 
            onClick={() => encerrarPartida(jogoAtual)}
            disabled={jogoAtual.pontosA < 25 && jogoAtual.pontosB < 25}
          >
            Encerrar Partida
          </button>
        </div>
      ) : proximoJogo ? (
        <div className={styles.card}>
          <h2>Próxima Partida: {proximoJogo.horario}</h2>
          <h3>{proximoJogo.timeA.nome} X {proximoJogo.timeB.nome}</h3>
          <button className={styles.btnPrimary} style={{ marginTop: '20px' }} onClick={() => iniciarPartida(proximoJogo.id)}>
            Iniciar Partida
          </button>
        </div>
      ) : statusTorneio === 'fase_grupos' ? (
        <div className={styles.card}>
          <h2>Fase de Grupos Encerrada!</h2>
          <p>Os 15 jogos foram finalizados e os 4 melhores estão definidos.</p>
          <button className={styles.btnPrimary} style={{ marginTop: '20px' }} onClick={gerarSemifinais}>
            Gerar Semifinais (1ºx4º e 2ºx3º)
          </button>
        </div>
      ) : statusTorneio === 'semifinais' ? (
        <div className={styles.card}>
          <h2>Semifinais Encerradas!</h2>
          <p>Aguardando a geração das Finais.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <h2>O torneio foi concluído!</h2>
        </div>
      )}
    </div>
  );
}