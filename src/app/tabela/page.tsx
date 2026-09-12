"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '../../firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import styles from './tabela.module.css';

interface Time { id: string; nome: string; escudoUrl: string; }
interface TimeDb { id: string; nome: string; escudoUrl: string; sets_vencidos: number; total_pontos: number; pontos_classificacao: number; }
interface Partida { id: string; fase: string; horario: string; status: string; pontosA: number; pontosB: number; setsVencidosA?: number; setsVencidosB?: number; timeA: Time; timeB: Time; }
interface Regras { nomeCampeonato: string; mostrarLogos: boolean; horarioInicio: string; intervaloMinutos: number; formatoGrupos: string; formatoFinais: string; sistemaClassificacao: string; ptsVitoriaPerfeita: number; ptsVitoriaTiebreak: number; ptsDerrotaTiebreak: number; }

export default function HubTorneio() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'classificacao' | 'live' | 'admin'>('jogos');
  const [timesClassificacao, setTimesClassificacao] = useState<TimeDb[]>([]);
  const [timesBase, setTimesBase] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');
  const [regras, setRegras] = useState<Regras | null>(null);

  const [senha, setSenha] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});

  useEffect(() => {
    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || '');
        setRegras(data.config?.regras || null);
        setTimesMap(data.times || {});
        
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
          partidasArray.sort((a, b) => {
            const numA = parseInt(a.id.split('_')[1]);
            const numB = parseInt(b.id.split('_')[1]);
            return numA - numB;
          });
          setPartidas(partidasArray);
        }
      } else {
        setStatusTorneio(''); setTimesMap({}); setPartidas([]); setRegras(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: FormEvent) => { e.preventDefault(); if (senha === 'volei2026') setAutenticado(true); else alert('Senha incorreta! Acesso negado.'); };
  const iniciarPartida = async (id: string) => { await update(ref(db, `torneio/partidas/${id}`), { status: 'em_andamento' }); };
  const atualizarPlacar = async (id: string, time: 'A' | 'B', valor: number) => {
    const jogo = partidas.find(p => p.id === id);
    if (!jogo) return;
    const campo = time === 'A' ? 'pontosA' : 'pontosB';
    let novoValor = jogo[campo] + valor;
    if (novoValor < 0) novoValor = 0;
    await update(ref(db, `torneio/partidas/${id}`), { [campo]: novoValor });
  };

  const encerrarAcao = async (jogo: Partida) => {
    const formatoPartida = jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
    const isMelhorDe3 = formatoPartida?.includes('melhor_de_3');
    const pontosBase = formatoPartida?.includes('_21') ? 21 : 25;
    
    const isTieBreak = isMelhorDe3 && jogo.setsVencidosA === 1 && jogo.setsVencidosB === 1;
    const pontosNecessarios = isTieBreak ? 15 : pontosBase;
    
    if (jogo.pontosA < pontosNecessarios && jogo.pontosB < pontosNecessarios) {
      if (!confirm(`Nenhum time atingiu os ${pontosNecessarios} pontos previstos. Encerrar mesmo assim?`)) return;
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
          let ptsA = 0; let ptsB = 0;
          if (regras?.sistemaClassificacao === 'sistema_pontos') {
            if (novosSetsA === 2 && novosSetsB === 0) { ptsA = regras.ptsVitoriaPerfeita; }
            else if (novosSetsB === 2 && novosSetsA === 0) { ptsB = regras.ptsVitoriaPerfeita; }
            else if (novosSetsA === 2 && novosSetsB === 1) { ptsA = regras.ptsVitoriaTiebreak; ptsB = regras.ptsDerrotaTiebreak; }
            else if (novosSetsB === 2 && novosSetsA === 1) { ptsB = regras.ptsVitoriaTiebreak; ptsA = regras.ptsDerrotaTiebreak; }
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
        let ptsA = 0; let ptsB = 0;
        if (regras?.sistemaClassificacao === 'sistema_pontos') {
          if (vencedorA) ptsA = regras.ptsVitoriaPerfeita;
          if (vencedorB) ptsB = regras.ptsVitoriaPerfeita;
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
    if (timesArray.length < 4) { alert("Mínimo 4 equipes."); return; }
    if (!confirm("Gerar Semifinais?")) return;
    timesArray.sort((a, b) => {
      if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
      if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
      return (b.total_pontos || 0) - (a.total_pontos || 0);
    });
    const classificados = timesArray.slice(0, 4);
    const updates: Record<string, string | Partida> = {};
    updates['torneio/config/status'] = 'semifinais';
    updates['torneio/partidas/jogo_16'] = { id: 'jogo_16', fase: 'semifinal', horario: 'SEMIFINAL 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[3] };
    updates['torneio/partidas/jogo_17'] = { id: 'jogo_17', fase: 'semifinal', horario: 'SEMIFINAL 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[1], timeB: classificados[2] };
    await update(ref(db), updates);
  };

  const gerarFinais = async () => {
    if (!confirm("Gerar Finais?")) return;
    const semi1 = partidas.find(p => p.id === 'jogo_16');
    const semi2 = partidas.find(p => p.id === 'jogo_17');
    if (!semi1 || !semi2) return;
    const isSemi1MelhorDe3 = (semi1.setsVencidosA || 0) === 2 || (semi1.setsVencidosB || 0) === 2;
    const semi1VenceuA = isSemi1MelhorDe3 ? (semi1.setsVencidosA === 2) : (semi1.pontosA > semi1.pontosB);
    const isSemi2MelhorDe3 = (semi2.setsVencidosA || 0) === 2 || (semi2.setsVencidosB || 0) === 2;
    const semi2VenceuA = isSemi2MelhorDe3 ? (semi2.setsVencidosA === 2) : (semi2.pontosA > semi2.pontosB);
    const vencedor16 = semi1VenceuA ? semi1.timeA : semi1.timeB; const perdedor16 = semi1VenceuA ? semi1.timeB : semi1.timeA;
    const vencedor17 = semi2VenceuA ? semi2.timeA : semi2.timeB; const perdedor17 = semi2VenceuA ? semi2.timeB : semi2.timeA;
    const updates: Record<string, string | Partida> = {};
    updates['torneio/config/status'] = 'finais';
    updates['torneio/partidas/jogo_18'] = { id: 'jogo_18', fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: perdedor16, timeB: perdedor17 };
    updates['torneio/partidas/jogo_19'] = { id: 'jogo_19', fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: vencedor16, timeB: vencedor17 };
    await update(ref(db), updates);
  };

  const resetarTorneio = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso apagará tudo. Deseja continuar?")) return;
    if (!confirm("Tem certeza absoluta?")) return;
    try {
      await remove(ref(db, 'torneio'));
      alert("Torneio zerado! Redirecionando para o Setup...");
      router.push('/setup');
    } catch {
      alert("Erro ao zerar o torneio.");
    }
  };

  const gerarTabelaDinamica = async () => {
    if (timesBase.length < 3) { alert("Mínimo de 3 equipes."); return; }
    if (!regras) { alert("Configure o torneio no Setup."); return; }
    const timesSorteados = [...timesBase];
    for (let i = timesSorteados.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [timesSorteados[i], timesSorteados[j]] = [timesSorteados[j], timesSorteados[i]]; }
    const listaTrabalho = [...timesSorteados];
    if (listaTrabalho.length % 2 !== 0) listaTrabalho.push({ id: 'folga_ficticia', nome: 'FOLGA', escudoUrl: '' });
    const confrontosGerados: [number, number][] = [];
    const copiaRotacao = [...listaTrabalho];
    for (let rodada = 0; rodada < listaTrabalho.length - 1; rodada++) {
      for (let i = 0; i < listaTrabalho.length / 2; i++) {
        const time1 = copiaRotacao[i]; const time2 = copiaRotacao[listaTrabalho.length - 1 - i];
        if (time1.id !== 'folga_ficticia' && time2.id !== 'folga_ficticia') { confrontosGerados.push([timesSorteados.findIndex(t => t.id === time1.id), timesSorteados.findIndex(t => t.id === time2.id)]); }
      }
      const ultimo = copiaRotacao.pop()!; copiaRotacao.splice(1, 0, ultimo);
    }
    const novasPartidas: Record<string, Partida> = {};
    const [horaStr, minStr] = regras.horarioInicio.split(':');
    const minutosIniciais = parseInt(horaStr) * 60 + parseInt(minStr);
    confrontosGerados.forEach((confronto, index) => {
      const min = minutosIniciais + (index * regras.intervaloMinutos);
      novasPartidas[`jogo_${index + 1}`] = {
        id: `jogo_${index + 1}`, fase: 'grupos', horario: `${Math.floor(min / 60) % 24}`.padStart(2, '0') + ':' + `${min % 60}`.padStart(2, '0'),
        status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesSorteados[confronto[0]], timeB: timesSorteados[confronto[1]]
      };
    });
    await update(ref(db, 'torneio/config'), { status: 'fase_grupos' });
    await set(ref(db, 'torneio/partidas'), novasPartidas);
  };

  const jogoAtual = partidas.find(p => p.status === 'em_andamento');
  const proximoJogo = partidas.find(p => p.status === 'pendente');
  const formatoPartidaAtual = jogoAtual?.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
  const isMelhorDe3Shared = formatoPartidaAtual?.includes('melhor_de_3');
  const isTieBreakShared = isMelhorDe3Shared && jogoAtual?.setsVencidosA === 1 && jogoAtual?.setsVencidosB === 1;
  const pontosBaseAdmin = formatoPartidaAtual?.includes('_21') ? 21 : 25;
  const tetoPontos = isTieBreakShared ? 15 : pontosBaseAdmin;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{regras?.nomeCampeonato || 'Campeonato Vôlei'}</h1>
        
        <div className={styles.tabs}>
          <button className={`${styles.tabBtn} ${abaAtiva === 'jogos' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('jogos')}>Tabela de Jogos</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'classificacao' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('classificacao')}>Classificação</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'live' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('live')}>Telão Ao Vivo</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'admin' ? styles.tabBtnActive : ''}`} onClick={() => setAbaAtiva('admin')} style={{ borderBottomColor: abaAtiva === 'admin' ? '#ef4444' : 'transparent', color: abaAtiva === 'admin' ? '#ef4444' : '' }}>⚙️ Mesa</button>
        </div>
        {statusTorneio === 'aguardando_sorteio' && abaAtiva === 'jogos' && (
          <button className={styles.btnGerar} onClick={gerarTabelaDinamica}>Embaralhar Times e Gerar Tabela Dinâmica</button>
        )}
      </div>

      {abaAtiva === 'jogos' && (
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
                  <div className={styles.time}>
                    {regras?.mostrarLogos && <Image src={jogo.timeA.escudoUrl} alt="A" className={styles.escudo} width={50} height={50} />} 
                    <span>{jogo.timeA.nome}</span>
                  </div>
                  <div className={styles.placarCentral}>
                    {isMd3 && jogo.status !== 'pendente' && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold' }}>Sets: {jogo.setsVencidosA || 0} - {jogo.setsVencidosB || 0}</span>}
                    <span className={styles.placarNumeros}>{jogo.status === 'pendente' ? 'X' : `${jogo.pontosA} - ${jogo.pontosB}`}</span>
                    <span className={`${styles.statusTag} ${classeStatus}`}>{textoStatus}</span>
                  </div>
                  <div className={styles.time}>
                    {regras?.mostrarLogos && <Image src={jogo.timeB.escudoUrl} alt="B" className={styles.escudo} width={50} height={50} />} 
                    <span>{jogo.timeB.nome}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {abaAtiva === 'classificacao' && (
        <div className={styles.tableWrapper}>
          <div className={styles.tableContainer}>
            <table className={styles.tableClassificacao}>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th style={{ textAlign: 'left' }}>Time</th>
                  {regras?.sistemaClassificacao === 'sistema_pontos' && <th>Pts</th>}
                  <th>Vitórias (Sets)</th>
                  <th>Saldo de Pontos</th>
                </tr>
              </thead>
              <tbody>
                {timesClassificacao.map((time, index) => (
                  <tr key={time.id}>
                    <td className={styles.rank}>{index + 1}º</td>
                    <td>
                      <div className={styles.teamCell}>
                        {regras?.mostrarLogos && <Image src={time.escudoUrl} alt="Escudo" width={35} height={35} className={styles.escudo} />} 
                        {time.nome}
                      </div>
                    </td>
                    {regras?.sistemaClassificacao === 'sistema_pontos' && (
                      <td style={{ fontWeight: 'bold', color: 'var(--btn-bg)', fontSize: '18px' }}>{time.pontos_classificacao || 0}</td>
                    )}
                    <td className={styles.vitorias}>{time.sets_vencidos || 0}</td>
                    <td style={{ fontWeight: 'bold' }}>{time.total_pontos || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === 'live' && (
        <div className={styles.liveContainer}>
          {jogoAtual ? (
            <>
              <div className={styles.headerLive}><span className={styles.liveBadge}>AO VIVO</span> <span className={styles.horarioBadge}>{jogoAtual.horario}</span></div>
              {isMelhorDe3Shared && <div className={styles.setsInfo}>Placar de Sets: <strong>{jogoAtual.setsVencidosA || 0}</strong> x <strong>{jogoAtual.setsVencidosB || 0}</strong></div>}
              <div className={styles.placarLive}>
                <div className={styles.timeCol}>
                  {regras?.mostrarLogos && <div className={styles.escudoWrapper}><Image src={jogoAtual.timeA.escudoUrl} alt="A" className={styles.escudoLive} width={90} height={90} /></div>}
                  <h3 className={styles.timeNomeLive}>{jogoAtual.timeA.nome}</h3> <span className={styles.pontuacao}>{jogoAtual.pontosA}</span>
                </div>
                <div className={styles.vsCard}><span className={styles.vsText}>X</span></div>
                <div className={styles.timeCol}>
                  {regras?.mostrarLogos && <div className={styles.escudoWrapper}><Image src={jogoAtual.timeB.escudoUrl} alt="B" className={styles.escudoLive} width={90} height={90} /></div>}
                  <h3 className={styles.timeNomeLive}>{jogoAtual.timeB.nome}</h3> <span className={styles.pontuacao}>{jogoAtual.pontosB}</span>
                </div>
              </div>
            </>
          ) : proximoJogo ? (
             <div className={styles.mensagemEspera}>
              <h2 style={{ color: '#38bdf8' }}>Próxima Partida - {proximoJogo.horario}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px', justifyContent: 'center', margin: '30px 0' }}>
                 <div style={{ textAlign: 'center' }}>
                   {regras?.mostrarLogos && <Image src={proximoJogo.timeA.escudoUrl} alt="A" width={80} height={80} style={{ objectFit: 'contain' }} />}
                   <p style={{ fontWeight: 'bold' }}>{proximoJogo.timeA.nome}</p>
                 </div>
                 <span className={styles.vsText}>X</span>
                 <div style={{ textAlign: 'center' }}>
                   {regras?.mostrarLogos && <Image src={proximoJogo.timeB.escudoUrl} alt="B" width={80} height={80} style={{ objectFit: 'contain' }} />}
                   <p style={{ fontWeight: 'bold' }}>{proximoJogo.timeB.nome}</p>
                 </div>
              </div>
            </div>
          ) : (<div className={styles.mensagemEspera}><h2>Torneio Finalizado! 🏆</h2></div>)}
        </div>
      )}

      {abaAtiva === 'admin' && (
        !autenticado ? (
          <form onSubmit={handleLogin} className={styles.loginBox}><h2 style={{ color: '#ef4444', marginBottom: '10px' }}>🔒 Acesso Restrito</h2><input type="password" placeholder="Senha da Mesa" className={styles.input} value={senha} onChange={(e) => setSenha(e.target.value)} /><button type="submit" className={styles.btnPrimary}>Acessar</button></form>
        ) : (
          <div>
            {jogoAtual ? (
              <div className={styles.card}>
                <h2 style={{ color: '#10b981', textAlign: 'center' }}>Jogo em Andamento - {jogoAtual.horario}</h2>
                {isMelhorDe3Shared && (
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: '#10b981' }}>Sets: {jogoAtual.setsVencidosA || 0} x {jogoAtual.setsVencidosB || 0}</h3>
                    {isTieBreakShared && <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold' }}>TIE-BREAK</span>}
                  </div>
                )}
                <div className={styles.scoreBoard}>
                  <div className={styles.teamColAdmin}>
                    <h3>{jogoAtual.timeA.nome}</h3><span className={styles.scoreText}>{jogoAtual.pontosA}</span>
                    <div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'A', 1)}>+</button></div>
                  </div>
                  <h2 style={{ fontSize: '40px', color: '#475569' }}>X</h2>
                  <div className={styles.teamColAdmin}>
                    <h3>{jogoAtual.timeB.nome}</h3><span className={styles.scoreText}>{jogoAtual.pontosB}</span>
                    <div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => atualizarPlacar(jogoAtual.id, 'B', 1)}>+</button></div>
                  </div>
                </div>
                <button className={styles.btnEnd} onClick={() => encerrarAcao(jogoAtual)} disabled={jogoAtual.pontosA < tetoPontos && jogoAtual.pontosB < tetoPontos}>
                  {isMelhorDe3Shared ? 'Encerrar Set' : 'Encerrar Partida'}
                </button>
              </div>
            ) : proximoJogo ? (
              <div className={styles.card} style={{ textAlign: 'center' }}><h2>Próxima Partida: {proximoJogo.horario}</h2><h3 style={{ margin: '20px 0' }}>{proximoJogo.timeA.nome} X {proximoJogo.timeB.nome}</h3><button className={styles.btnPrimary} onClick={() => iniciarPartida(proximoJogo.id)}>Iniciar</button></div>
            ) : statusTorneio === 'fase_grupos' ? (
              <div className={styles.card} style={{ textAlign: 'center' }}><h2>Fase de Grupos Encerrada!</h2><button className={styles.btnPrimary} onClick={gerarSemifinais}>Gerar Semifinais</button></div>
            ) : statusTorneio === 'semifinais' ? (
              <div className={styles.card} style={{ textAlign: 'center' }}><h2>Semifinais Encerradas!</h2><button className={styles.btnPrimary} style={{ backgroundColor: '#f59e0b' }} onClick={gerarFinais}>Gerar Final</button></div>
            ) : statusTorneio === 'finais' ? (
              <div className={styles.card} style={{ textAlign: 'center' }}><h2>Torneio Finalizado! 🏆</h2></div>
            ) : null}
            <div className={styles.dangerZone}><button className={styles.btnDanger} onClick={resetarTorneio}>Zerar Campeonato</button></div>
          </div>
        )
      )}
    </div>
  );
}