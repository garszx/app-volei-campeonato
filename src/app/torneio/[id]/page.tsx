"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { db } from '../../../firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import styles from './tabela.module.css';

interface Time { id: string; nome: string; escudoUrl: string; }
interface TimeDb { id: string; nome: string; escudoUrl: string; sets_vencidos: number; total_pontos: number; pontos_classificacao: number; }
interface Partida { id: string; fase: string; horario: string; status: string; pontosA: number; pontosB: number; setsVencidosA?: number; setsVencidosB?: number; timeA: Time; timeB: Time; }
interface Regras { nomeCampeonato: string; mostrarLogos: boolean; horarioInicio: string; intervaloMinutos: number; formatoGrupos: string; formatoFinais: string; sistemaClassificacao: string; turno: string; senhaAdmin?: string; }

export default function HubTorneio() {
  const router = useRouter();
  const params = useParams();
  const torneioId = params.id as string;

  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'classificacao' | 'live' | 'admin'>('jogos');
  const [timesClassificacao, setTimesClassificacao] = useState<TimeDb[]>([]);
  const [timesBase, setTimesBase] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');
  const [regras, setRegras] = useState<Regras | null>(null);
  const [senha, setSenha] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});

  // Estados para Edição de Partida
  const [partidaEditando, setPartidaEditando] = useState<string | null>(null);
  const [editPontosA, setEditPontosA] = useState(0);
  const [editPontosB, setEditPontosB] = useState(0);
  const [editSetsA, setEditSetsA] = useState(0);
  const [editSetsB, setEditSetsB] = useState(0);

  useEffect(() => {
    if (!torneioId) return;
    const torneioRef = ref(db, `torneios/${torneioId}`);
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || ''); setRegras(data.config?.regras || null); setTimesMap(data.times || {});
        if (data.times) {
          setTimesBase(Object.values(data.times));
          const timesArray = Object.values(data.times) as TimeDb[];
          timesArray.sort((a, b) => {
            if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
            if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
            return (b.total_pontos || 0) - (a.total_pontos || 0);
          });
          setTimesClassificacao(timesArray);
        }
        if (data.partidas) {
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => parseInt(a.id.split('_')[1]) - parseInt(b.id.split('_')[1]));
          setPartidas(partidasArray);
        }
      } else {
        setStatusTorneio(''); setTimesMap({}); setPartidas([]); setRegras(null);
      }
    });
    return () => unsubscribe();
  }, [torneioId]);

  const handleLogin = (e: FormEvent) => { 
    e.preventDefault(); 
    const senhaCorreta = regras?.senhaAdmin || 'volei2026';
    if (senha === senhaCorreta) setAutenticado(true); 
    else alert('Senha incorreta! Acesso negado.'); 
  };
  
  const iniciarPartida = async (id: string) => { await update(ref(db, `torneios/${torneioId}/partidas/${id}`), { status: 'em_andamento' }); };
  
  const atualizarPlacar = async (id: string, time: 'A' | 'B', valor: number) => {
    const jogo = partidas.find(p => p.id === id);
    if (!jogo) return;
    const campo = time === 'A' ? 'pontosA' : 'pontosB';
    let novoValor = jogo[campo] + valor;
    if (novoValor < 0) novoValor = 0;
    await update(ref(db, `torneios/${torneioId}/partidas/${id}`), { [campo]: novoValor });
  };

  const recalcularTabela = async (partidasAtualizadas: Partida[]) => {
    const timesTemp = JSON.parse(JSON.stringify(timesMap)) as Record<string, TimeDb>;
    
    // Zera os pontos de todos os times para recalcular
    Object.keys(timesTemp).forEach(k => {
      timesTemp[k].total_pontos = 0;
      timesTemp[k].sets_vencidos = 0;
      timesTemp[k].pontos_classificacao = 0;
    });

    const isMd3Grupos = regras?.formatoGrupos?.includes('melhor_de_3');

    partidasAtualizadas.forEach(p => {
      if (p.fase === 'grupos' && p.status === 'finalizado') {
        const tA = timesTemp[p.timeA.id];
        const tB = timesTemp[p.timeB.id];
        if (!tA || !tB) return;

        tA.total_pontos += p.pontosA;
        tB.total_pontos += p.pontosB;

        const venceuA = p.pontosA > p.pontosB;
        const venceuB = p.pontosB > p.pontosA;

        let setsA = p.setsVencidosA || 0;
        let setsB = p.setsVencidosB || 0;

        if (!isMd3Grupos) {
          setsA = venceuA ? 1 : 0;
          setsB = venceuB ? 1 : 0;
        }

        tA.sets_vencidos += setsA;
        tB.sets_vencidos += setsB;

        if (regras?.sistemaClassificacao === 'sistema_pontos') {
          if (isMd3Grupos) {
            if (setsA === 2 && setsB === 0) { tA.pontos_classificacao += 3; }
            else if (setsB === 2 && setsA === 0) { tB.pontos_classificacao += 3; }
            else if (setsA === 2 && setsB === 1) { tA.pontos_classificacao += 2; tB.pontos_classificacao += 1; }
            else if (setsB === 2 && setsA === 1) { tB.pontos_classificacao += 2; tA.pontos_classificacao += 1; }
          } else {
            if (venceuA) tA.pontos_classificacao += 3;
            if (venceuB) tB.pontos_classificacao += 3;
          }
        }
      }
    });

    await update(ref(db, `torneios/${torneioId}/times`), timesTemp);
  };

  const abrirEdicao = (p: Partida) => {
    setPartidaEditando(p.id);
    setEditPontosA(p.pontosA);
    setEditPontosB(p.pontosB);
    setEditSetsA(p.setsVencidosA || 0);
    setEditSetsB(p.setsVencidosB || 0);
  };

  const salvarEdicao = async (jogoId: string) => {
    await update(ref(db, `torneios/${torneioId}/partidas/${jogoId}`), {
      pontosA: editPontosA,
      pontosB: editPontosB,
      setsVencidosA: editSetsA,
      setsVencidosB: editSetsB
    });
    const novasPartidas = partidas.map(p => p.id === jogoId ? { ...p, pontosA: editPontosA, pontosB: editPontosB, setsVencidosA: editSetsA, setsVencidosB: editSetsB } : p);
    await recalcularTabela(novasPartidas);
    setPartidaEditando(null);
    alert("Partida corrigida e tabela de classificação recalculada!");
  };

  const encerrarAcao = async (jogo: Partida) => {
    const formatoPartida = jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
    const isMelhorDe3 = formatoPartida?.includes('melhor_de_3');
    const pontosBase = formatoPartida?.includes('_21') ? 21 : 25;
    const isTieBreak = isMelhorDe3 && jogo.setsVencidosA === 1 && jogo.setsVencidosB === 1;
    const pontosNecessarios = isTieBreak ? 15 : pontosBase;
    
    if (jogo.pontosA === jogo.pontosB) { alert("O set não pode terminar empatado!"); return; }

    const pontosVencedor = Math.max(jogo.pontosA, jogo.pontosB);
    const pontosPerdedor = Math.min(jogo.pontosA, jogo.pontosB);
    const pontosExatosParaVencer = Math.max(pontosNecessarios, pontosPerdedor + 2);

    if (pontosVencedor > pontosExatosParaVencer) {
      alert(`Placar inválido (passou do limite)! Com o perdedor tendo ${pontosPerdedor} pontos, o set deveria fechar exatamente em ${pontosExatosParaVencer}. Use o botão (-) para arrumar os pontos extras antes de encerrar.`);
      return;
    }

    if (pontosVencedor < pontosExatosParaVencer) {
      let aviso = `O placar não atingiu a pontuação mínima oficial para fechar o set (${pontosExatosParaVencer} pontos).`;
      if (pontosVencedor >= pontosNecessarios && (pontosVencedor - pontosPerdedor) < 2) {
         aviso = `Pela regra oficial, é obrigatório ter 2 pontos de diferença para fechar o set. O placar atual está ${jogo.pontosA}x${jogo.pontosB} (O alvo correto seria ${pontosExatosParaVencer}).`;
      }
      if (!confirm(`${aviso}\n\nDeseja forçar o encerramento mesmo assim?`)) return;
    }

    const updates: Record<string, string | number> = {};
    const vencedorA = jogo.pontosA > jogo.pontosB; 
    const vencedorB = jogo.pontosB > jogo.pontosA;

    if (isMelhorDe3) {
      const novosSetsA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0);
      const novosSetsB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0);
      
      if (novosSetsA === 2 || novosSetsB === 2) {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      } else {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosA`] = 0; 
        updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosB`] = 0;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA; 
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      }
    } else {
      updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
    }
    
    await update(ref(db), updates);
    
    // Motor de recalculo
    const matchParaRecalculo = { ...jogo, status: 'finalizado', pontosA: jogo.pontosA, pontosB: jogo.pontosB };
    if (isMelhorDe3) {
      matchParaRecalculo.setsVencidosA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0);
      matchParaRecalculo.setsVencidosB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0);
    }
    
    const isFimDePartida = !isMelhorDe3 || matchParaRecalculo.setsVencidosA === 2 || matchParaRecalculo.setsVencidosB === 2;
    if (isFimDePartida) {
      const novasPartidas = partidas.map(p => p.id === jogo.id ? matchParaRecalculo : p);
      await recalcularTabela(novasPartidas);
    }
  };

  const gerarSemifinais = async () => {
    const timesArray = Object.values(timesMap);
    if (timesArray.length < 4) return;
    if (!confirm("Gerar Semifinais?")) return;
    timesArray.sort((a, b) => {
      if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
      if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
      return (b.total_pontos || 0) - (a.total_pontos || 0);
    });
    const classificados = timesArray.slice(0, 4);
    const updates: Record<string, string | Partida> = {};
    const numMatches = partidas.length;
    updates[`torneios/${torneioId}/config/status`] = 'semifinais';
    updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[3] };
    updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[1], timeB: classificados[2] };
    await update(ref(db), updates);
  };

  const gerarFinalDireta = async () => {
    const timesArray = Object.values(timesMap);
    if (!confirm("Gerar a Grande Final entre o 1º e o 2º da tabela?")) return;
    timesArray.sort((a, b) => {
      if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
      if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
      return (b.total_pontos || 0) - (a.total_pontos || 0);
    });
    const classificados = timesArray.slice(0, 2);
    const updates: Record<string, string | Partida> = {};
    const numMatches = partidas.length;
    updates[`torneios/${torneioId}/config/status`] = 'finais';
    updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[1] };
    await update(ref(db), updates);
  };

  const gerarFinais = async () => {
    if (!confirm("Gerar Finais?")) return;
    const numMatches = partidas.length;
    const semi1 = partidas[numMatches - 2];
    const semi2 = partidas[numMatches - 1];
    if (!semi1 || !semi2) return;
    const isSemi1MelhorDe3 = (semi1.setsVencidosA || 0) === 2 || (semi1.setsVencidosB || 0) === 2;
    const semi1VenceuA = isSemi1MelhorDe3 ? (semi1.setsVencidosA === 2) : (semi1.pontosA > semi1.pontosB);
    const isSemi2MelhorDe3 = (semi2.setsVencidosA || 0) === 2 || (semi2.setsVencidosB || 0) === 2;
    const semi2VenceuA = isSemi2MelhorDe3 ? (semi2.setsVencidosA === 2) : (semi2.pontosA > semi2.pontosB);
    const vencedor16 = semi1VenceuA ? semi1.timeA : semi1.timeB; const perdedor16 = semi1VenceuA ? semi1.timeB : semi1.timeA;
    const vencedor17 = semi2VenceuA ? semi2.timeA : semi2.timeB; const perdedor17 = semi2VenceuA ? semi2.timeB : semi2.timeA;
    const updates: Record<string, string | Partida> = {};
    updates[`torneios/${torneioId}/config/status`] = 'finais';
    updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: perdedor16, timeB: perdedor17 };
    updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: vencedor16, timeB: vencedor17 };
    await update(ref(db), updates);
  };

  const encerrarCampeonatoPontosCorridos = async () => {
    if (!confirm("Tem certeza que deseja encerrar o torneio? O 1º colocado da tabela atual será o campeão!")) return;
    await update(ref(db, `torneios/${torneioId}/config`), { status: 'finais' });
  };

  const gerarRelatorioELimpar = async () => {
    const confirmacao = confirm("Deseja gerar um PDF de relatório? Após salvar o PDF, o torneio será APAGADO do banco de dados para liberar espaço no sistema.");
    if (!confirmacao) return;
    window.print();
    setTimeout(async () => {
      try { await remove(ref(db, `torneios/${torneioId}`)); alert("Torneio excluído com sucesso! O sistema foi reciclado e o espaço liberado."); router.push('/setup'); } catch { alert("Erro ao tentar limpar o banco de dados."); }
    }, 1000);
  };

  const gerarTabelaDinamica = async () => {
    if (timesBase.length < 3) return;
    const timesSorteados = [...timesBase];
    for (let i = timesSorteados.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [timesSorteados[i], timesSorteados[j]] = [timesSorteados[j], timesSorteados[i]]; }
    const listaTrabalho = [...timesSorteados];
    if (listaTrabalho.length % 2 !== 0) listaTrabalho.push({ id: 'folga_ficticia', nome: 'FOLGA', escudoUrl: '' });
    
    const confrontosGerados: [number, number][] = []; const copiaRotacao = [...listaTrabalho];
    for (let rodada = 0; rodada < listaTrabalho.length - 1; rodada++) {
      for (let i = 0; i < listaTrabalho.length / 2; i++) {
        const time1 = copiaRotacao[i]; const time2 = copiaRotacao[listaTrabalho.length - 1 - i];
        if (time1.id !== 'folga_ficticia' && time2.id !== 'folga_ficticia') { confrontosGerados.push([timesSorteados.findIndex(t => t.id === time1.id), timesSorteados.findIndex(t => t.id === time2.id)]); }
      }
      const ultimo = copiaRotacao.pop()!; copiaRotacao.splice(1, 0, ultimo);
    }

    if (regras?.turno === 'ida_volta') {
      const totalJogos = confrontosGerados.length;
      for (let i = 0; i < totalJogos; i++) {
        confrontosGerados.push([confrontosGerados[i][1], confrontosGerados[i][0]]);
      }
    }

    const novasPartidas: Record<string, Partida> = {};
    const [horaStr, minStr] = regras?.horarioInicio.split(':') || ['08', '00'];
    const minutosIniciais = parseInt(horaStr) * 60 + parseInt(minStr);
    confrontosGerados.forEach((confronto, index) => {
      const min = minutosIniciais + (index * (regras?.intervaloMinutos || 45));
      novasPartidas[`jogo_${index + 1}`] = {
        id: `jogo_${index + 1}`, fase: 'grupos', horario: `${Math.floor(min / 60) % 24}`.padStart(2, '0') + ':' + `${min % 60}`.padStart(2, '0'),
        status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesSorteados[confronto[0]], timeB: timesSorteados[confronto[1]]
      };
    });
    await update(ref(db, `torneios/${torneioId}/config`), { status: 'fase_grupos' });
    await set(ref(db, `torneios/${torneioId}/partidas`), novasPartidas);
  };

  const jogoAtual = partidas.find(p => p.status === 'em_andamento'); 
  const proximoJogo = partidas.find(p => p.status === 'pendente');
  const formatoPartidaAtual = jogoAtual?.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
  const isMelhorDe3Shared = formatoPartidaAtual?.includes('melhor_de_3');
  const isTieBreakShared = isMelhorDe3Shared && jogoAtual?.setsVencidosA === 1 && jogoAtual?.setsVencidosB === 1;

  const renderHeader = () => (
    <div className={styles.header}>
      <h1 className={styles.title}>{regras?.nomeCampeonato || 'Carregando...'}</h1>
      <div className={`${styles.tabs} no-print`}>
        <button className={`${styles.tabBtn} ${abaAtiva === 'jogos' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('jogos')}>Tabela de Jogos</button>
        <button className={`${styles.tabBtn} ${abaAtiva === 'classificacao' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('classificacao')}>Classificação</button>
        <button className={`${styles.tabBtn} ${abaAtiva === 'live' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('live')}>Telão Ao Vivo</button>
        <button className={`${styles.tabBtn} ${abaAtiva === 'admin' ? styles.tabBtnAdminActive : ''}`} onClick={() => setAbaAtiva('admin')}>⚙️ Mesa</button>
      </div>
      {statusTorneio === 'aguardando_sorteio' && abaAtiva === 'jogos' && (
        <button className={`${styles.btnGerar} no-print`} onClick={gerarTabelaDinamica}>Embaralhar e Gerar Tabela Dinâmica</button>
      )}
    </div>
  );

  const renderAbaJogos = () => (
    <div className={`${abaAtiva === 'jogos' ? '' : styles.hideOnScreen} ${styles.showOnPrint}`}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Tabela de Jogos</h2>
      <div className={styles.listaJogos}>
        {partidas.map((jogo) => {
          const num = jogo.id.split('_')[1];
          let classeStatus = styles.statusPendente; let textoStatus = 'Aguardando';
          if (jogo.status === 'em_andamento') { classeStatus = styles.statusAndamento; textoStatus = 'Ao Vivo'; }
          if (jogo.status === 'finalizado') { classeStatus = styles.statusFinalizado; textoStatus = 'Finalizado'; }
          const isMd3 = (jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');

          return (
            <div key={jogo.id} className={styles.cardJogo}>
              <div className={styles.cardTop}>
                <span className={styles.jogoNumero}>{jogo.fase === 'final' ? '🏆 GRANDE FINAL' : jogo.fase === 'terceiro_lugar' ? '🥉 Disputa 3º' : jogo.fase === 'semifinal' ? `Semifinal` : `Jogo ${num}`}</span>
                <span className={styles.horario}>{jogo.horario}</span>
              </div>
              <div className={styles.confronto}>
                <div className={styles.time}>{regras?.mostrarLogos && <Image src={jogo.timeA.escudoUrl} alt="A" className={`${styles.escudo} ${styles.imageContain}`} width={50} height={50} />} <span>{jogo.timeA.nome}</span></div>
                <div className={styles.placarCentral}>
                  {isMd3 && jogo.status !== 'pendente' && <span className={styles.setsLabel}>Sets: {jogo.setsVencidosA || 0} - {jogo.setsVencidosB || 0}</span>}
                  <span className={styles.placarNumeros}>{jogo.status === 'pendente' ? 'X' : `${jogo.pontosA} - ${jogo.pontosB}`}</span>
                  <span className={`${styles.statusTag} ${classeStatus}`}>{textoStatus}</span>
                </div>
                <div className={styles.time}>{regras?.mostrarLogos && <Image src={jogo.timeB.escudoUrl} alt="B" className={`${styles.escudo} ${styles.imageContain}`} width={50} height={50} />} <span>{jogo.timeB.nome}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAbaClassificacao = () => (
    <div className={`${abaAtiva === 'classificacao' ? '' : styles.hideOnScreen} ${styles.showOnPrint} ${styles.printPageBreak}`}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Classificação Final</h2>
      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          <table className={styles.tableClassificacao}>
            <thead>
              <tr>
                <th>Pos</th><th className={styles.textLeft}>Time</th>
                {regras?.sistemaClassificacao === 'sistema_pontos' && <th>Pts</th>}
                <th>Vitórias (Sets)</th><th>Saldo de Pontos</th>
              </tr>
            </thead>
            <tbody>
              {timesClassificacao.map((time, index) => (
                <tr key={time.id}>
                  <td className={styles.rank}>{index + 1}º</td>
                  <td><div className={styles.teamCell}>{regras?.mostrarLogos && <Image src={time.escudoUrl} alt="Escudo" width={35} height={35} className={`${styles.escudo} ${styles.imageContain}`} />} {time.nome}</div></td>
                  {regras?.sistemaClassificacao === 'sistema_pontos' && <td className={styles.pontosClassificacao}>{time.pontos_classificacao || 0}</td>}
                  <td className={styles.vitorias}>{time.sets_vencidos || 0}</td><td className={styles.boldText}>{time.total_pontos || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAbaLive = () => (
    <div className={`${abaAtiva === 'live' ? '' : styles.hideOnScreen} ${styles.hideOnPrint}`}>
      <div className={styles.liveContainer}>
        {jogoAtual ? (
          <>
            <div className={styles.headerLive}><span className={styles.liveBadge}>AO VIVO</span> <span className={styles.horarioBadge}>{jogoAtual.horario}</span></div>
            {isMelhorDe3Shared && <div className={styles.setsInfo}>Placar de Sets: <strong>{jogoAtual.setsVencidosA || 0}</strong> x <strong>{jogoAtual.setsVencidosB || 0}</strong></div>}
            <div className={styles.placarLive}>
              <div className={styles.timeCol}>{regras?.mostrarLogos && <div className={styles.escudoWrapper}><Image src={jogoAtual.timeA.escudoUrl} alt="A" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} /></div>}<h3 className={styles.timeNomeLive}>{jogoAtual.timeA.nome}</h3> <span className={styles.pontuacao}>{jogoAtual.pontosA}</span></div>
              <div className={styles.vsCard}><span className={styles.vsText}>X</span></div>
              <div className={styles.timeCol}>{regras?.mostrarLogos && <div className={styles.escudoWrapper}><Image src={jogoAtual.timeB.escudoUrl} alt="B" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} /></div>}<h3 className={styles.timeNomeLive}>{jogoAtual.timeB.nome}</h3> <span className={styles.pontuacao}>{jogoAtual.pontosB}</span></div>
            </div>
          </>
        ) : proximoJogo ? (
            <div className={styles.mensagemEspera}>
            <h2 className={styles.nextGameTitle}>Próxima Partida - {proximoJogo.horario}</h2>
            <div className={styles.nextGameContainer}>
                <div className={styles.textCenter}>{regras?.mostrarLogos && <Image src={proximoJogo.timeA.escudoUrl} alt="A" width={80} height={80} className={styles.imageContain} />}<p className={styles.boldText}>{proximoJogo.timeA.nome}</p></div>
                <span className={styles.vsText}>X</span>
                <div className={styles.textCenter}>{regras?.mostrarLogos && <Image src={proximoJogo.timeB.escudoUrl} alt="B" width={80} height={80} className={styles.imageContain} />}<p className={styles.boldText}>{proximoJogo.timeB.nome}</p></div>
            </div>
          </div>
        ) : (<div className={styles.mensagemEspera}><h2>Torneio Finalizado! 🏆</h2></div>)}
      </div>
    </div>
  );

  const renderAbaAdmin = () => {
    const isMd3Geral = regras?.formatoGrupos?.includes('melhor_de_3') || regras?.formatoFinais?.includes('melhor_de_3');
    
    return (
      <div className={`${abaAtiva === 'admin' ? '' : styles.hideOnScreen} ${styles.hideOnPrint}`}>
        {!autenticado ? (
          <form onSubmit={handleLogin} className={styles.loginBox}><h2 className={styles.adminWarningTitle}>🔒 Acesso Restrito</h2><input type="password" placeholder="Senha da Mesa" className={styles.input} value={senha} onChange={(e) => setSenha(e.target.value)} /><button type="submit" className={styles.btnPrimary}>Acessar</button></form>
        ) : (
          <div>
            {/* PAINEL DO JOGO ATUAL */}
            {jogoAtual ? (
              <div className={styles.card}>
                <h2 className={styles.adminGameTitle}>Jogo em Andamento - {jogoAtual.horario}</h2>
                {isMelhorDe3Shared && (
                  <div className={styles.textCenter}><h3 className={styles.adminSetsTitle}>Sets: {jogoAtual.setsVencidosA || 0} x {jogoAtual.setsVencidosB || 0}</h3>{isTieBreakShared && <span className={styles.tieBreakBadge}>TIE-BREAK</span>}</div>
                )}
                <div className={styles.scoreBoard}>
                  <div className={styles.teamColAdmin}><h3>{jogoAtual.timeA.nome}</h3><span className={styles.scoreText}>{jogoAtual.pontosA}</span><div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', 1)}>+</button></div></div>
                  <h2 className={styles.adminVsText}>X</h2>
                  <div className={styles.teamColAdmin}><h3>{jogoAtual.timeB.nome}</h3><span className={styles.scoreText}>{jogoAtual.pontosB}</span><div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', 1)}>+</button></div></div>
                </div>
                <button className={styles.btnEnd} onClick={() => encerrarAcao(jogoAtual)}>{isMelhorDe3Shared ? 'Encerrar Set' : 'Encerrar Partida'}</button>
              </div>
            ) : proximoJogo ? (
              <div className={`${styles.card} ${styles.textCenter}`}><h2>Próxima Partida: {proximoJogo.horario}</h2><h3 className={styles.adminNextGameMatch}>{proximoJogo.timeA.nome} X {proximoJogo.timeB.nome}</h3><button className={styles.btnPrimary} onClick={() => iniciarPartida(proximoJogo.id)}>Iniciar</button></div>
            ) : statusTorneio === 'fase_grupos' ? (
              <div className={`${styles.card} ${styles.textCenter}`}>
                <h2>Fase de Grupos Encerrada!</h2>
                {regras?.sistemaClassificacao === 'vitorias_simples' ? (
                  <button className={styles.btnPrimary} onClick={encerrarCampeonatoPontosCorridos}>Encerrar Campeonato e Coroar Campeão 🏆</button>
                ) : timesBase.length === 3 ? (
                  <button className={styles.btnPrimary} onClick={gerarFinalDireta}>Gerar Grande Final Direta</button>
                ) : (
                  <button className={styles.btnPrimary} onClick={gerarSemifinais}>Gerar Semifinais</button>
                )}
              </div>
            ) : statusTorneio === 'semifinais' ? (
              <div className={`${styles.card} ${styles.textCenter}`}><h2>Semifinais Encerradas!</h2><button className={`${styles.btnPrimary} ${styles.btnWarning}`} onClick={gerarFinais}>Gerar Final</button></div>
            ) : statusTorneio === 'finais' ? (
              <div className={`${styles.card} ${styles.textCenter}`}><h2>Torneio Finalizado! 🏆</h2></div>
            ) : null}

            {/* MODO DE EDIÇÃO DE PARTIDAS FINALIZADAS */}
            {partidas.some(p => p.status === 'finalizado') && (
              <div className={styles.card} style={{ marginTop: '20px' }}>
                <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>✏️ Editar Partidas Finalizadas</h3>
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>Qualquer edição recalculará automaticamente a tabela de classificação.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {partidas.filter(p => p.status === 'finalizado').map(p => (
                    <div key={p.id} style={{ border: '1px solid #334155', padding: '10px', borderRadius: '8px', background: '#0f172a' }}>
                      {partidaEditando === p.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className={styles.textCenter} style={{ flex: 1 }}>
                              <p className={styles.boldText}>{p.timeA.nome}</p>
                              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Pontos</label><br/>
                              <input type="number" value={editPontosA} onChange={e => setEditPontosA(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} />
                              {isMd3Geral && <><br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Sets</label><br/><input type="number" value={editSetsA} onChange={e => setEditSetsA(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} /></>}
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#475569' }}>X</span>
                            <div className={styles.textCenter} style={{ flex: 1 }}>
                              <p className={styles.boldText}>{p.timeB.nome}</p>
                              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Pontos</label><br/>
                              <input type="number" value={editPontosB} onChange={e => setEditPontosB(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} />
                              {isMd3Geral && <><br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Sets</label><br/><input type="number" value={editSetsB} onChange={e => setEditSetsB(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} /></>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                            <button onClick={() => setPartidaEditando(null)} style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={() => salvarEdicao(p.id)} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Correção</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', color: '#94a3b8' }}>Jogo {p.id.split('_')[1]}</span>
                          <span className={styles.boldText}>{p.timeA.nome} {p.pontosA} x {p.pontosB} {p.timeB.nome}</span>
                          <button onClick={() => abrirEdicao(p)} style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️ Editar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className={styles.dangerZone}>
              <h3 className={styles.dangerTitle}>Gerar Relatório e Encerrar</h3>
              <p className={styles.dangerDesc}>Salve o PDF deste campeonato e limpe o banco de dados para o próximo.</p>
              <button className={styles.btnDanger} onClick={gerarRelatorioELimpar}>
                🖨️ Salvar PDF e Excluir Torneio
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {renderHeader()}
      {renderAbaJogos()}
      {renderAbaClassificacao()}
      {renderAbaLive()}
      {renderAbaAdmin()}
    </div>
  );
}