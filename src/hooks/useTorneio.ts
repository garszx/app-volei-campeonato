import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { Time, TimeDb, Partida, Regras } from '../types/torneio';

export function useTorneio(torneioId: string) {
  const router = useRouter();

  const [timesClassificacao, setTimesClassificacao] = useState<TimeDb[]>([]);
  const [timesBase, setTimesBase] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');
  const [regras, setRegras] = useState<Regras | null>(null);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});
  
  const [senha, setSenha] = useState('');
  const [nivelAcesso, setNivelAcesso] = useState<'visitante' | 'mesario' | 'mestre'>('visitante');
  const [isUpdatingScore, setIsUpdatingScore] = useState(false);
  
  const [mostrarEditorEquipes, setMostrarEditorEquipes] = useState(false);
  const [partidaEditando, setPartidaEditando] = useState<string | null>(null);
  const [editPontosA, setEditPontosA] = useState(0);
  const [editPontosB, setEditPontosB] = useState(0);
  const [editSetsA, setEditSetsA] = useState(0);
  const [editSetsB, setEditSetsB] = useState(0);
  const [editMestreTimeA, setEditMestreTimeA] = useState<string>('');
  const [editMestreTimeB, setEditMestreTimeB] = useState<string>('');
  const [editMestreStatus, setEditMestreStatus] = useState<string>('');
  const [editHorario, setEditHorario] = useState<string>('');

  const urlAtual = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (!torneioId) return;
    const torneioRef = ref(db, `torneios/${torneioId}`);
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
            const isSimples = data.config?.regras?.sistemaClassificacao !== 'sistema_pontos';
            if (isSimples) {
              if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
            } else {
              if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
            }
            if ((b.sets_average || 0) !== (a.sets_average || 0)) return (b.sets_average || 0) - (a.sets_average || 0);
            if ((b.points_average || 0) !== (a.points_average || 0)) return (b.points_average || 0) - (a.points_average || 0);
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
    if (senha === 'mestre') setNivelAcesso('mestre');
    else if (senha === (regras?.senhaAdmin || 'volei2026')) setNivelAcesso('mesario');
    else alert('Senha incorreta! Acesso negado.'); 
  };

  const fazerLogout = () => {
    setNivelAcesso('visitante'); setSenha(''); setPartidaEditando(null); setMostrarEditorEquipes(false);
  };

  const atualizarNomeEquipe = async (timeId: string, novoNome: string) => {
    if (!novoNome || novoNome.trim() === '' || timesMap[timeId].nome === novoNome) return; 
    const updates: Record<string, string> = {};
    updates[`torneios/${torneioId}/times/${timeId}/nome`] = novoNome;
    partidas.forEach(p => {
       if (p.timeA.id === timeId) updates[`torneios/${torneioId}/partidas/${p.id}/timeA/nome`] = novoNome;
       if (p.timeB.id === timeId) updates[`torneios/${torneioId}/partidas/${p.id}/timeB/nome`] = novoNome;
    });
    await update(ref(db), updates);
  };

  const handleUploadLogoGlobal = (timeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
       const base64 = reader.result as string;
       const updates: Record<string, string> = {};
       updates[`torneios/${torneioId}/times/${timeId}/escudoUrl`] = base64;
       partidas.forEach(p => {
          if (p.timeA.id === timeId) updates[`torneios/${torneioId}/partidas/${p.id}/timeA/escudoUrl`] = base64;
          if (p.timeB.id === timeId) updates[`torneios/${torneioId}/partidas/${p.id}/timeB/escudoUrl`] = base64;
       });
       await update(ref(db), updates);
    };
    reader.readAsDataURL(file);
  };

  const atualizarChaveEquipe = async (timeId: string, novaChave: string) => {
    if (!novaChave || timesMap[timeId].chave === novaChave) return; 
    await update(ref(db, `torneios/${torneioId}/times/${timeId}`), { chave: novaChave });
  };

  const iniciarPartida = async (id: string) => { await update(ref(db, `torneios/${torneioId}/partidas/${id}`), { status: 'em_andamento' }); };
  
  const atualizarPlacar = async (id: string, time: 'A' | 'B', valor: number) => {
    if (isUpdatingScore) return;
    setIsUpdatingScore(true);
    const jogo = partidas.find(p => p.id === id);
    if (!jogo) { setIsUpdatingScore(false); return; }
    const campo = time === 'A' ? 'pontosA' : 'pontosB';
    let novoValor = jogo[campo] + valor;
    if (novoValor < 0) novoValor = 0;
    await update(ref(db, `torneios/${torneioId}/partidas/${id}`), { [campo]: novoValor });
    setTimeout(() => setIsUpdatingScore(false), 200);
  };

  const recalcularTabela = async (partidasAtualizadas: Partida[]) => {
    const timesTemp = JSON.parse(JSON.stringify(timesMap)) as Record<string, TimeDb>;
    Object.keys(timesTemp).forEach(k => {
      timesTemp[k].total_pontos = 0; timesTemp[k].pontos_sofridos = 0;
      timesTemp[k].sets_vencidos = 0; timesTemp[k].sets_perdidos = 0; timesTemp[k].pontos_classificacao = 0;
    });
    const isMd3Grupos = regras?.formatoGrupos?.includes('melhor_de_3');

    partidasAtualizadas.forEach(p => {
      if (p.fase === 'grupos' && p.status === 'finalizado') {
        const tA = timesTemp[p.timeA.id]; const tB = timesTemp[p.timeB.id];
        if (!tA || !tB) return;
        tA.total_pontos += p.pontosA; tA.pontos_sofridos = (tA.pontos_sofridos || 0) + p.pontosB;
        tB.total_pontos += p.pontosB; tB.pontos_sofridos = (tB.pontos_sofridos || 0) + p.pontosA;
        const venceuA = p.pontosA > p.pontosB; const venceuB = p.pontosB > p.pontosA;
        let setsA = p.setsVencidosA || 0; let setsB = p.setsVencidosB || 0;
        if (!isMd3Grupos) { setsA = venceuA ? 1 : 0; setsB = venceuB ? 1 : 0; }
        tA.sets_vencidos += setsA; tA.sets_perdidos = (tA.sets_perdidos || 0) + setsB;
        tB.sets_vencidos += setsB; tB.sets_perdidos = (tB.sets_perdidos || 0) + setsA;

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

    Object.keys(timesTemp).forEach(k => {
       const t = timesTemp[k];
       t.sets_average = (t.sets_perdidos || 0) === 0 ? ((t.sets_vencidos || 0) === 0 ? 0 : 999) : ((t.sets_vencidos || 0) / (t.sets_perdidos || 1));
       t.points_average = (t.pontos_sofridos || 0) === 0 ? ((t.total_pontos || 0) === 0 ? 0 : 999) : ((t.total_pontos || 0) / (t.pontos_sofridos || 1));
    });
    await update(ref(db, `torneios/${torneioId}/times`), timesTemp);
  };

  const abrirEdicao = (p: Partida) => {
    setPartidaEditando(p.id); setEditPontosA(p.pontosA); setEditPontosB(p.pontosB);
    setEditSetsA(p.setsVencidosA || 0); setEditSetsB(p.setsVencidosB || 0);
    setEditMestreTimeA(p.timeA.id); setEditMestreTimeB(p.timeB.id); 
    setEditMestreStatus(p.status); setEditHorario(p.horario);
  };

  const salvarEdicao = async (jogoId: string) => {
    const jogoOriginal = partidas.find(p => p.id === jogoId);
    if (!jogoOriginal) return;

    const timeAAtualizado = nivelAcesso === 'mestre' && editMestreTimeA ? timesMap[editMestreTimeA] : jogoOriginal.timeA;
    const timeBAtualizado = nivelAcesso === 'mestre' && editMestreTimeB ? timesMap[editMestreTimeB] : jogoOriginal.timeB;
    const statusAtualizado = nivelAcesso === 'mestre' && editMestreStatus ? editMestreStatus : jogoOriginal.status;
    const horarioAtualizado = nivelAcesso === 'mestre' && editHorario ? editHorario : jogoOriginal.horario;

    const dadosAtualizados = { 
        pontosA: editPontosA, pontosB: editPontosB, setsVencidosA: editSetsA, setsVencidosB: editSetsB,
        timeA: timeAAtualizado, timeB: timeBAtualizado, status: statusAtualizado, horario: horarioAtualizado
    };

    await update(ref(db, `torneios/${torneioId}/partidas/${jogoId}`), dadosAtualizados);
    const novasPartidas = partidas.map(p => p.id === jogoId ? { ...p, ...dadosAtualizados } : p);
    await recalcularTabela(novasPartidas); setPartidaEditando(null);
    alert("Alterações aplicadas e tabela recalculada!");
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

    if (pontosVencedor > pontosExatosParaVencer) { alert(`Placar inválido!`); return; }
    if (pontosVencedor < pontosExatosParaVencer) { if (!confirm(`O placar não atingiu a regra. Forçar encerramento?`)) return; }

    const updates: Record<string, string | number> = {};
    const vencedorA = jogo.pontosA > jogo.pontosB; const vencedorB = jogo.pontosB > jogo.pontosA;

    if (isMelhorDe3) {
      const novosSetsA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0);
      const novosSetsB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0);
      if (novosSetsA === 2 || novosSetsB === 2) {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      } else {
        updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosA`] = 0; updates[`torneios/${torneioId}/partidas/${jogo.id}/pontosB`] = 0;
        updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosA`] = novosSetsA; updates[`torneios/${torneioId}/partidas/${jogo.id}/setsVencidosB`] = novosSetsB;
      }
    } else {
      updates[`torneios/${torneioId}/partidas/${jogo.id}/status`] = 'finalizado';
    }
    
    await update(ref(db), updates);
    const matchParaRecalculo = { ...jogo, status: 'finalizado', pontosA: jogo.pontosA, pontosB: jogo.pontosB };
    if (isMelhorDe3) { matchParaRecalculo.setsVencidosA = (jogo.setsVencidosA || 0) + (vencedorA ? 1 : 0); matchParaRecalculo.setsVencidosB = (jogo.setsVencidosB || 0) + (vencedorB ? 1 : 0); }
    if (!isMelhorDe3 || matchParaRecalculo.setsVencidosA === 2 || matchParaRecalculo.setsVencidosB === 2) {
      const novasPartidas = partidas.map(p => p.id === jogo.id ? matchParaRecalculo : p);
      await recalcularTabela(novasPartidas);
    }
  };

  const gerarTabelaDinamica = async () => {
    if (timesBase.length < 3) return;
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
    await update(ref(db), updates); await set(ref(db, `torneios/${torneioId}/partidas`), novasPartidas);
  };

  const gerarSemifinais = async () => {
    const isDuasChaves = timesClassificacao.some(t => t.chave === 'A' || t.chave === 'B');
    const updates: Record<string, string | Partida> = {};
    const numMatches = partidas.length;

    if (isDuasChaves) {
        const timesA = timesClassificacao.filter(t => t.chave === 'A'); const timesB = timesClassificacao.filter(t => t.chave === 'B');
        if (timesA.length < 2 || timesB.length < 2) { alert("Não há times suficientes."); return; }
        if (!confirm("Gerar Semifinais Cruzadas?")) return;
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesA[0], timeB: timesB[1] };
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: timesB[0], timeB: timesA[1] };
    } else {
        if (timesClassificacao.length < 4) return;
        if (!confirm("Gerar Semifinais?")) return;
        const classificados = timesClassificacao.slice(0, 4);
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 1}`] = { id: `jogo_${numMatches + 1}`, fase: 'semifinal', horario: 'SEMI 1', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[3] };
        updates[`torneios/${torneioId}/partidas/jogo_${numMatches + 2}`] = { id: `jogo_${numMatches + 2}`, fase: 'semifinal', horario: 'SEMI 2', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[1], timeB: classificados[2] };
    }
    updates[`torneios/${torneioId}/config/status`] = 'semifinais';
    await update(ref(db), updates);
  };

  const gerarFinalDireta = async () => {
    if (!confirm("Gerar a Grande Final Direta?")) return;
    const isDuasChaves = timesClassificacao.some(t => t.chave === 'A' || t.chave === 'B');
    const classificados = isDuasChaves ? [timesClassificacao.filter(t => t.chave === 'A')[0], timesClassificacao.filter(t => t.chave === 'B')[0]] : timesClassificacao.slice(0, 2);
    const updates: Record<string, string | Partida> = {};
    updates[`torneios/${torneioId}/config/status`] = 'finais';
    updates[`torneios/${torneioId}/partidas/jogo_${partidas.length + 1}`] = { id: `jogo_${partidas.length + 1}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: classificados[0], timeB: classificados[1] };
    await update(ref(db), updates);
  };

  const gerarFinais = async () => {
    if (!confirm("Gerar Finais?")) return;
    const semi1 = partidas[partidas.length - 2]; const semi2 = partidas[partidas.length - 1];
    if (!semi1 || !semi2) return;
    const semi1VenceuA = ((semi1.setsVencidosA || 0) === 2 || (semi1.setsVencidosB || 0) === 2) ? (semi1.setsVencidosA === 2) : (semi1.pontosA > semi1.pontosB);
    const semi2VenceuA = ((semi2.setsVencidosA || 0) === 2 || (semi2.setsVencidosB || 0) === 2) ? (semi2.setsVencidosA === 2) : (semi2.pontosA > semi2.pontosB);
    const vencedor16 = semi1VenceuA ? semi1.timeA : semi1.timeB; const perdedor16 = semi1VenceuA ? semi1.timeB : semi1.timeA;
    const vencedor17 = semi2VenceuA ? semi2.timeA : semi2.timeB; const perdedor17 = semi2VenceuA ? semi2.timeB : semi2.timeA;
    const updates: Record<string, string | Partida> = {};
    updates[`torneios/${torneioId}/config/status`] = 'finais';
    updates[`torneios/${torneioId}/partidas/jogo_${partidas.length + 1}`] = { id: `jogo_${partidas.length + 1}`, fase: 'terceiro_lugar', horario: 'DISPUTA 3º', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: perdedor16, timeB: perdedor17 };
    updates[`torneios/${torneioId}/partidas/jogo_${partidas.length + 2}`] = { id: `jogo_${partidas.length + 2}`, fase: 'final', horario: 'FINAL', status: 'pendente', pontosA: 0, pontosB: 0, setsVencidosA: 0, setsVencidosB: 0, timeA: vencedor16, timeB: vencedor17 };
    await update(ref(db), updates);
  };

  const encerrarCampeonatoPontosCorridos = async () => {
    if (!confirm("Tem certeza que deseja encerrar o torneio?")) return;
    await update(ref(db, `torneios/${torneioId}/config`), { status: 'finais' });
  };

  const gerarRelatorioELimpar = async () => {
    if (!confirm("Deseja gerar o PDF e APAGAR o torneio do banco de dados?")) return;
    window.print();
    setTimeout(async () => {
      try { await remove(ref(db, `torneios/${torneioId}`)); alert("Torneio excluído com sucesso!"); router.push('/setup'); } catch { alert("Erro."); }
    }, 1000);
  };

  const baixarQRCode = async () => {
    const urlApi = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(urlAtual)}`;
    try {
      const response = await fetch(urlApi); const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = blobUrl; a.download = `QR-Code.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(blobUrl);
    } catch { alert('Erro ao baixar.'); }
  };
  
  const compartilharLink = () => {
    if (navigator.share) { navigator.share({ title: regras?.nomeCampeonato || 'Torneio', url: urlAtual }).catch(() => {}); } 
    else { navigator.clipboard.writeText(urlAtual); alert('Link copiado!'); }
  };

  const jogoAtual = partidas.find(p => p.status === 'em_andamento'); 
  const proximoJogo = partidas.find(p => p.status === 'pendente');

  const verificarInversaoFIVB = (jogo: Partida | undefined): boolean => {
    if (!jogo) return false;
    const formatoPartida = jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
    const isMd3 = formatoPartida?.includes('melhor_de_3');
    if (!isMd3) return false;
    const setsJogados = (jogo.setsVencidosA || 0) + (jogo.setsVencidosB || 0);
    if (setsJogados === 1) return true;
    if (setsJogados === 2) {
        if (Math.max(jogo.pontosA, jogo.pontosB) >= 8) return true;
    }
    return false;
  };
  const isInvertido = verificarInversaoFIVB(jogoAtual);

  
  return {
    timesClassificacao, timesBase, partidas, statusTorneio, regras, timesMap,
    senha, setSenha, nivelAcesso, mostrarEditorEquipes, setMostrarEditorEquipes,
    partidaEditando, setPartidaEditando, editPontosA, setEditPontosA, editPontosB, setEditPontosB,
    editSetsA, setEditSetsA, editSetsB, setEditSetsB, editMestreTimeA, setEditMestreTimeA,
    editMestreTimeB, setEditMestreTimeB, editMestreStatus, setEditMestreStatus, editHorario, setEditHorario,
    urlAtual, jogoAtual, proximoJogo, isInvertido,
    handleLogin, fazerLogout, atualizarNomeEquipe, handleUploadLogoGlobal, atualizarChaveEquipe,
    iniciarPartida, atualizarPlacar, recalcularTabela, abrirEdicao, salvarEdicao, encerrarAcao,
    gerarTabelaDinamica, gerarSemifinais, gerarFinalDireta, gerarFinais, encerrarCampeonatoPontosCorridos,
    gerarRelatorioELimpar, baixarQRCode, compartilharLink
  };
}