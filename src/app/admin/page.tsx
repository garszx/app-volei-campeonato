"use client";

import { useEffect, useState, FormEvent } from 'react';
import { db } from '../../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import styles from './admin.module.css';

interface TimeDb {
  id: string;
  nome: string;
  escudoUrl: string;
  sets_vencidos: number;
  total_pontos: number;
  pontos_classificacao: number;
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
  setsVencidosA?: number; 
  setsVencidosB?: number; 
  timeA: TimeDaPartida;
  timeB: TimeDaPartida;
}

interface Regras {
  horarioInicio: string;
  intervaloMinutos: number;
  formatoGrupos: string;
  formatoFinais: string;
  sistemaClassificacao: string;
  ptsVitoriaPerfeita: number;
  ptsVitoriaTiebreak: number;
  ptsDerrotaTiebreak: number;
}

export default function PainelAdmin() {
  const [senha, setSenha] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});
  const [statusTorneio, setStatusTorneio] = useState<string>('');
  const [regras, setRegras] = useState<Regras | null>(null);

  useEffect(() => {
    if (!autenticado) return;

    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || '');
        setRegras(data.config?.regras || null);
        setTimesMap(data.times || {});
        
        if (data.partidas) {
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => {
            const numA = parseInt(a.id.split('_')[1]);
            const numB = parseInt(b.id.split('_')[1]);
            return numA - numB;
          });
          setPartidas(partidasArray);
        } else {
          setPartidas([]);
        }
      } else {
        setStatusTorneio('');
        setTimesMap({});
        setPartidas([]);
        setRegras(null);
      }
    });

    return () => unsubscribe();
  }, [autenticado]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (senha === 'volei2026') setAutenticado(true);
    else alert('Senha incorreta');
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

  const encerrarAcao = async (jogo: Partida) => {
    const isMelhorDe3 = (jogo.fase === 'grupos' && regras?.formatoGrupos === 'melhor_de_3') || 
                        ((jogo.fase === 'semifinal' || jogo.fase === 'final' || jogo.fase === 'terceiro_lugar') && regras?.formatoFinais === 'melhor_de_3');
    
    const isTieBreak = isMelhorDe3 && jogo.setsVencidosA === 1 && jogo.setsVencidosB === 1;
    const pontosNecessarios = isTieBreak ? 15 : 25;
    
    if (jogo.pontosA < pontosNecessarios && jogo.pontosB < pontosNecessarios) {
      if (!confirm(`Nenhum time atingiu ${pontosNecessarios} pontos. Encerrar ${isMelhorDe3 ? 'set' : 'partida'} mesmo assim?`)) return;
    }

    const updates: Record<string, string | number> = {};
    const vencedorA = jogo.pontosA > jogo.pontosB;
    const vencedorB = jogo.pontosB > jogo.pontosA;

    const timeA_db = timesMap[jogo.timeA.id];
    const timeB_db = timesMap[jogo.timeB.id];

    if (isMelhorDe3) {
      const novosSetsA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0);
      const novosSetsB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0);

      if (novosSetsA === 2 || novosSetsB === 2) {
        updates[`torneio/partidas/${jogo.id}/status`] = 'finalizado';
        updates[`torneio/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneio/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;

        if (timeA_db && timeB_db && jogo.fase === 'grupos') {
          let ptsA = 0;
          let ptsB = 0;
          
          if (regras?.sistemaClassificacao === 'sistema_pontos') {
            if (novosSetsA === 2 && novosSetsB === 0) { ptsA = regras.ptsVitoriaPerfeita; }
            else if (novosSetsB === 2 && novosSetsA === 0) { ptsB = regras.ptsVitoriaPerfeita; }
            else if (novosSetsA === 2 && novosSetsB === 1) { ptsA = regras.ptsVitoriaTiebreak; ptsB = regras.ptsDerrotaTiebreak; }
            else if (novosSetsB === 2 && novosSetsA === 1) { ptsB = regras.ptsVitoriaTiebreak; ptsA = regras.ptsDerrotaTiebreak; }
          } else {
            if (novosSetsA === 2) ptsA = 1;
            if (novosSetsB === 2) ptsB = 1;
          }

          updates[`torneio/times/${jogo.timeA.id}/pontos_classificacao`] = (timeA_db.pontos_classificacao || 0) + ptsA;
          updates[`torneio/times/${jogo.timeB.id}/pontos_classificacao`] = (timeB_db.pontos_classificacao || 0) + ptsB;
          updates[`torneio/times/${jogo.timeA.id}/sets_vencidos`] = (timeA_db.sets_vencidos || 0) + novosSetsA;
          updates[`torneio/times/${jogo.timeB.id}/sets_vencidos`] = (timeB_db.sets_vencidos || 0) + novosSetsB;
        }
      } else {
        updates[`torneio/partidas/${jogo.id}/pontosA`] = 0;
        updates[`torneio/partidas/${jogo.id}/pontosB`] = 0;
        updates[`torneio/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneio/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      }
    } else {
      updates[`torneio/partidas/${jogo.id}/status`] = 'finalizado';
      
      if (timeA_db && timeB_db && jogo.fase === 'grupos') {
        let ptsA = 0;
        let ptsB = 0;
        
        if (regras?.sistemaClassificacao === 'sistema_pontos') {
          if (vencedorA) ptsA = regras.ptsVitoriaPerfeita;
          if (vencedorB) ptsB = regras.ptsVitoriaPerfeita;
        } else {
          if (vencedorA) ptsA = 1;
          if (vencedorB) ptsB = 1;
        }

        updates[`torneio/times/${jogo.timeA.id}/pontos_classificacao`] = (timeA_db.pontos_classificacao || 0) + ptsA;
        updates[`torneio/times/${jogo.timeB.id}/pontos_classificacao`] = (timeB_db.pontos_classificacao || 0) + ptsB;
        updates[`torneio/times/${jogo.timeA.id}/sets_vencidos`] = (timeA_db.sets_vencidos || 0) + (vencedorA ? 1 : 0);
        updates[`torneio/times/${jogo.timeB.id}/sets_vencidos`] = (timeB_db.sets_vencidos || 0) + (vencedorB ? 1 : 0);
      }
    }

    if (timeA_db && timeB_db && jogo.fase === 'grupos') {
        updates[`torneio/times/${jogo.timeA.id}/total_pontos`] = (timeA_db.total_pontos || 0) + jogo.pontosA;
        updates[`torneio/times/${jogo.timeB.id}/total_pontos`] = (timeB_db.total_pontos || 0) + jogo.pontosB;
    }

    await update(ref(db), updates);
  };

  const gerarSemifinais = async () => {
    const timesArray = Object.values(timesMap);
    
    if (timesArray.length < 4) {
      alert("Para gerar semifinais, é necessário ter pelo menos 4 equipes cadastradas. Torneios com 3 equipes vão direto para a Final!");
      return;
    }

    if (!confirm("Confirmar o encerramento da fase de grupos e gerar as Semifinais?")) return;
    
    timesArray.sort((a, b) => {
      if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) {
        return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
      }
      if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) {
        return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
      }
      return (b.total_pontos || 0) - (a.total_pontos || 0);
    });

    const classificados = timesArray.slice(0, 4);

    const updates: Record<string, string | Partida> = {};
    updates['torneio/config/status'] = 'semifinais';
    
    updates['torneio/partidas/jogo_16'] = {
      id: 'jogo_16', fase: 'semifinal', horario: 'SEMIFINAL 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0,
      timeA: { id: classificados[0].id, nome: classificados[0].nome, escudoUrl: classificados[0].escudoUrl }, 
      timeB: { id: classificados[3].id, nome: classificados[3].nome, escudoUrl: classificados[3].escudoUrl }
    };
    updates['torneio/partidas/jogo_17'] = {
      id: 'jogo_17', fase: 'semifinal', horario: 'SEMIFINAL 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0,
      timeA: { id: classificados[1].id, nome: classificados[1].nome, escudoUrl: classificados[1].escudoUrl }, 
      timeB: { id: classificados[2].id, nome: classificados[2].nome, escudoUrl: classificados[2].escudoUrl }
    };

    await update(ref(db), updates);
  };

  const gerarFinais = async () => {
    if (!confirm("Gerar a Grande Final e a Disputa de 3º Lugar?")) return;
    
    const semi1 = partidas.find(p => p.id === 'jogo_16');
    const semi2 = partidas.find(p => p.id === 'jogo_17');
    if (!semi1 || !semi2) return;

    const isSemi1MelhorDe3 = (semi1.setsVencidosA || 0) === 2 || (semi1.setsVencidosB || 0) === 2;
    const semi1VenceuA = isSemi1MelhorDe3 ? (semi1.setsVencidosA === 2) : (semi1.pontosA > semi1.pontosB);
    
    const isSemi2MelhorDe3 = (semi2.setsVencidosA || 0) === 2 || (semi2.setsVencidosB || 0) === 2;
    const semi2VenceuA = isSemi2MelhorDe3 ? (semi2.setsVencidosA === 2) : (semi2.pontosA > semi2.pontosB);

    const vencedor16 = semi1VenceuA ? semi1.timeA : semi1.timeB;
    const perdedor16 = semi1VenceuA ? semi1.timeB : semi1.timeA;
    const vencedor17 = semi2VenceuA ? semi2.timeA : semi2.timeB;
    const perdedor17 = semi2VenceuA ? semi2.timeB : semi2.timeA;

    const updates: Record<string, string | Partida> = {};
    updates['torneio/config/status'] = 'finais';

    updates['torneio/partidas/jogo_18'] = {
      id: 'jogo_18', fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente',
      pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: perdedor16, timeB: perdedor17
    };
    updates['torneio/partidas/jogo_19'] = {
      id: 'jogo_19', fase: 'final', horario: 'FINAL', status: 'pendente',
      pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: vencedor16, timeB: vencedor17
    };

    await update(ref(db), updates);
  };

  const resetarTorneio = async () => {
    const confirmacao1 = confirm("⚠️ ATENÇÃO: Isso vai apagar TODOS os times, partidas e configurações. Deseja continuar?");
    if (!confirmacao1) return;
    const confirmacao2 = confirm("Tem certeza absoluta? Essa ação NÃO PODE SER DESFEITA.");
    if (!confirmacao2) return;

    try {
      await remove(ref(db, 'torneio'));
      alert("Torneio zerado com sucesso! Você pode voltar para a aba de Configuração (/setup) para iniciar um novo.");
    } catch (error) {
      console.error("Erro ao resetar torneio:", error);
      alert("Houve um erro ao tentar zerar o torneio.");
    }
  };

  if (!autenticado) {
    return (
      <div className={styles.container}>
        <form onSubmit={handleLogin} className={styles.loginBox}>
          <h2>Painel de Controle do Placar</h2>
          <input type="password" placeholder="Digite a senha" className={styles.input} value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="submit" className={styles.btnPrimary}>Acessar</button>
        </form>
      </div>
    );
  }

  const jogoAtual = partidas.find(p => p.status === 'em_andamento');
  const proximoJogo = partidas.find(p => p.status === 'pendente');
  
  const semi1 = partidas.find(p => p.id === 'jogo_16');
  const semi2 = partidas.find(p => p.id === 'jogo_17');
  const semisProntas = statusTorneio === 'semifinais' && semi1?.status === 'finalizado' && semi2?.status === 'finalizado';

  let isTieBreak = false;
  let isMelhorDe3 = false;
  let pontosNecessarios = 25;
  
  if (jogoAtual && regras) {
    isMelhorDe3 = (jogoAtual.fase === 'grupos' && regras.formatoGrupos === 'melhor_de_3') || 
                  ((jogoAtual.fase === 'semifinal' || jogoAtual.fase === 'final' || jogoAtual.fase === 'terceiro_lugar') && regras.formatoFinais === 'melhor_de_3');
    
    isTieBreak = isMelhorDe3 && jogoAtual.setsVencidosA === 1 && jogoAtual.setsVencidosB === 1;
    pontosNecessarios = isTieBreak ? 15 : 25;
  }

  return (
    <div className={styles.container}>
      <h1>Controle de Jogo</h1>

      {jogoAtual ? (
        <div className={styles.card}>
          <h2 style={{ color: 'var(--btn-bg)' }}>Jogo em Andamento - {jogoAtual.horario}</h2>
          
          {isMelhorDe3 && (
            <div>
              <h3 style={{ color: '#10b981', margin: '10px 0' }}>
                Sets: {jogoAtual.setsVencidosA || 0} x {jogoAtual.setsVencidosB || 0}
              </h3>
              {isTieBreak && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  TIE-BREAK (15 pontos)
                </span>
              )}
            </div>
          )}
          
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
            onClick={() => encerrarAcao(jogoAtual)}
            disabled={jogoAtual.pontosA < pontosNecessarios && jogoAtual.pontosB < pontosNecessarios}
          >
            {isMelhorDe3 ? 'Encerrar Set' : 'Encerrar Partida'}
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
          <button className={styles.btnPrimary} style={{ marginTop: '20px' }} onClick={gerarSemifinais}>Gerar Semifinais</button>
        </div>
      ) : semisProntas ? (
        <div className={styles.card}>
          <h2>Semifinais Encerradas!</h2>
          <button className={styles.btnPrimary} style={{ marginTop: '20px', backgroundColor: '#f59e0b' }} onClick={gerarFinais}>
            Gerar Final e Disputa de 3º
          </button>
        </div>
      ) : statusTorneio === 'finais' ? (
        <div className={styles.card}>
          <h2>Torneio Finalizado! Campeão Definido! 🏆</h2>
        </div>
      ) : (
        <div className={styles.card}>
          <h2>Aguardando início do torneio...</h2>
        </div>
      )}

      <div className={styles.dangerZone}>
        <h3 style={{ color: '#ef4444', margin: 0 }}>Zona de Perigo</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--foreground)' }}>
          Use apenas para excluir todo o progresso atual e iniciar uma nova edição do campeonato.
        </p>
        <button className={styles.btnDanger} onClick={resetarTorneio}>
          Zerar Torneio
        </button>
      </div>

    </div>
  );
}