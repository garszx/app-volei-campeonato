import { useEffect, useState, FormEvent, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import { Time, TimeDb, Partida, Regras } from '../types/torneio';

export function useTorneio(torneioId: string) {
  const router = useRouter();
  const timesMapRef = useRef<Record<string, TimeDb>>({});
  const ultimoCliqueRef = useRef<number>(0);
  const bloqueioCliqueRef = useRef<boolean>(false);
  const placarOtimistaRef = useRef<Record<string, { pontosA: number; pontosB: number }>>({});

  const [timesClassificacao, setTimesClassificacao] = useState<TimeDb[]>([]);
  const [timesBase, setTimesBase] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');
  const [regras, setRegras] = useState<Regras | null>(null);
  const [timesMap, setTimesMap] = useState<Record<string, TimeDb>>({});
  
  const [senha, setSenha] = useState('');
  const [nivelAcesso, setNivelAcesso] = useState<'visitante' | 'mesario' | 'mestre'>('visitante');
  
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
  const [editParciais, setEditParciais] = useState<string>('');

  const urlAtual = typeof window !== 'undefined' ? window.location.href : '';

  const carregarDados = useCallback(async () => {
    if (!torneioId) return;

    const { data: torneio } = await supabase.from('torneios').select('*').eq('id', torneioId).single();
    const { data: timesDB } = await supabase.from('times').select('*').eq('torneio_id', torneioId);
    const { data: partidasDB } = await supabase.from('partidas').select('*').eq('torneio_id', torneioId).order('ordem', { ascending: true });

    if (torneio) {
      setStatusTorneio(torneio.status || '');
      setRegras(torneio.regras || null);
    }

    if (timesDB) {
      const mapaTimes: Record<string, TimeDb> = {};
      const baseArray: Time[] = [];
      const classifArray: TimeDb[] = [];

      timesDB.forEach(t => {
        const timeFormatado: TimeDb = {
          ...t,
          escudoUrl: t.escudo_url,
          pontos_classificacao: t.pontos_classificacao,
          sets_vencidos: t.sets_vencidos,
          sets_perdidos: t.sets_perdidos,
          total_pontos: t.total_pontos,
          pontos_sofridos: t.pontos_sofridos,
          sets_average: t.sets_average,
          points_average: t.points_average
        };
        mapaTimes[t.id] = timeFormatado;
        baseArray.push({ id: t.id, nome: t.nome, escudoUrl: t.escudo_url });
        classifArray.push(timeFormatado);
      });

      classifArray.sort((a, b) => {
        const isSimples = torneio?.regras?.sistemaClassificacao !== 'sistema_pontos';
        if (isSimples) {
          if ((b.sets_vencidos || 0) !== (a.sets_vencidos || 0)) return (b.sets_vencidos || 0) - (a.sets_vencidos || 0);
        } else {
          if ((b.pontos_classificacao || 0) !== (a.pontos_classificacao || 0)) return (b.pontos_classificacao || 0) - (a.pontos_classificacao || 0);
        }
        if ((b.sets_average || 0) !== (a.sets_average || 0)) return (b.sets_average || 0) - (a.sets_average || 0);
        if ((b.points_average || 0) !== (a.points_average || 0)) return (b.points_average || 0) - (a.points_average || 0);
        return (b.total_pontos || 0) - (a.total_pontos || 0);
      });

      timesMapRef.current = mapaTimes;
      setTimesMap(mapaTimes);
      setTimesBase(baseArray);
      setTimesClassificacao(classifArray);

      if (partidasDB) {
        const isClicandoAgora = Date.now() - ultimoCliqueRef.current < 800;
        const partidasFormatadas: Partida[] = partidasDB.map((p, index) => {
          const otimista = placarOtimistaRef.current[p.id];
          const pA = isClicandoAgora && otimista ? otimista.pontosA : p.pontos_a;
          const pB = isClicandoAgora && otimista ? otimista.pontosB : p.pontos_b;

          if (!isClicandoAgora) {
            placarOtimistaRef.current[p.id] = { pontosA: p.pontos_a, pontosB: p.pontos_b };
          }

          return {
            id: p.id,
            ordem: p.ordem || (index + 1),
            numero: p.ordem || (index + 1),
            fase: p.fase,
            status: p.status,
            horario: p.horario,
            pontosA: pA,
            pontosB: pB,
            setsVencidosA: p.sets_vencidos_a,
            setsVencidosB: p.sets_vencidos_b,
            parciais: p.parciais,
            timeA: mapaTimes[p.time_a_id] || { id: p.time_a_id, nome: '?', escudoUrl: '' },
            timeB: mapaTimes[p.time_b_id] || { id: p.time_b_id, nome: '?', escudoUrl: '' }
          };
        });
        setPartidas(partidasFormatadas);
      }
    }
  }, [torneioId]);

  useEffect(() => {
    const carregarInicialmente = async () => {
      await carregarDados();
    };
    carregarInicialmente();

    const channel = supabase.channel('mudancas-torneio-' + torneioId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'torneios', filter: 'id=eq.' + torneioId }, carregarDados)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'times', filter: 'torneio_id=eq.' + torneioId }, carregarDados)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partidas', filter: 'torneio_id=eq.' + torneioId }, carregarDados)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'partidas', filter: 'torneio_id=eq.' + torneioId }, carregarDados)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas', filter: 'torneio_id=eq.' + torneioId }, (payload) => {
        const dados = payload.new;
        const mapaAtual = timesMapRef.current;
        const isClicandoAgora = Date.now() - ultimoCliqueRef.current < 800;

        if (!isClicandoAgora) {
          placarOtimistaRef.current[dados.id] = { pontosA: dados.pontos_a, pontosB: dados.pontos_b };
        }

        setPartidas(prev => prev.map(p => 
          p.id === dados.id 
            ? { 
                ...p, 
                horario: dados.horario ?? p.horario,
                fase: dados.fase ?? p.fase,
                pontosA: isClicandoAgora ? p.pontosA : dados.pontos_a, 
                pontosB: isClicandoAgora ? p.pontosB : dados.pontos_b, 
                setsVencidosA: dados.sets_vencidos_a, 
                setsVencidosB: dados.sets_vencidos_b, 
                status: dados.status,
                parciais: dados.parciais,
                timeA: dados.time_a_id && mapaAtual[dados.time_a_id] ? mapaAtual[dados.time_a_id] : p.timeA,
                timeB: dados.time_b_id && mapaAtual[dados.time_b_id] ? mapaAtual[dados.time_b_id] : p.timeB
              } 
            : p
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [torneioId, carregarDados]);

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
    if (!novoNome || novoNome.trim() === '' || timesMap[timeId]?.nome === novoNome) return; 
    await supabase.from('times').update({ nome: novoNome }).eq('id', timeId);
    await carregarDados();
  };

  const handleUploadLogoGlobal = (timeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
       const base64 = reader.result as string;
       await supabase.from('times').update({ escudo_url: base64 }).eq('id', timeId);
       await carregarDados();
    };
    reader.readAsDataURL(file);
  };

  const atualizarChaveEquipe = async (timeId: string, novaChave: string) => {
    if (!novaChave || timesMap[timeId]?.chave === novaChave) return; 
    await supabase.from('times').update({ chave: novaChave }).eq('id', timeId);
    await carregarDados();
  };

  const iniciarPartida = async (id: string) => { 
    setPartidas(prev => prev.map(p => p.id === id ? { ...p, status: 'em_andamento' } : p));
    await supabase.from('partidas').update({ status: 'em_andamento' }).eq('id', id);
  };
  
  const atualizarPlacar = async (id: string, time: 'A' | 'B', valor: number) => {
    if (bloqueioCliqueRef.current) return;

    bloqueioCliqueRef.current = true;
    ultimoCliqueRef.current = Date.now();

    const jogoEstado = partidas.find(p => p.id === id);
    const base = placarOtimistaRef.current[id] || {
      pontosA: jogoEstado?.pontosA || 0,
      pontosB: jogoEstado?.pontosB || 0
    };

    const novoA = time === 'A' ? Math.max(0, base.pontosA + valor) : base.pontosA;
    const novoB = time === 'B' ? Math.max(0, base.pontosB + valor) : base.pontosB;

    placarOtimistaRef.current[id] = { pontosA: novoA, pontosB: novoB };

    setPartidas(prevPartidas => 
      prevPartidas.map(p => (p.id === id ? { ...p, pontosA: novoA, pontosB: novoB } : p))
    );

    setTimeout(() => {
      bloqueioCliqueRef.current = false;
    }, 400);

    await supabase
      .from('partidas')
      .update({ pontos_a: novoA, pontos_b: novoB })
      .eq('id', id);
  };

  const encerrarAcao = async (jogo: Partida) => {
    const placarFinal = placarOtimistaRef.current[jogo.id];
    if (placarFinal) {
      await supabase
        .from('partidas')
        .update({ pontos_a: placarFinal.pontosA, pontos_b: placarFinal.pontosB })
        .eq('id', jogo.id);
    }

    ultimoCliqueRef.current = 0;
    bloqueioCliqueRef.current = false;
    delete placarOtimistaRef.current[jogo.id];

    try {
      await fetch('/api/partidas/encerrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId, partidaId: jogo.id }) });
      await carregarDados();
    } catch { alert("Falha de conexão."); }
  };

  const gerarTabelaDinamica = async () => {
    if (!confirm("Isso vai embaralhar as equipas e gerar a tabela de jogos oficial. Tem a certeza?")) return;
    try { 
      await fetch('/api/torneios/gerar-tabela', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId }) }); 
      await carregarDados();
    } catch { alert("Falha de conexão."); }
  };

  const gerarSemifinais = async () => {
    if (!confirm("Gerar Semifinais?")) return;
    try { 
      await fetch('/api/torneios/fases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId, acao: 'gerarSemifinais' }) }); 
      await carregarDados();
    } catch { alert("Falha na conexão."); }
  };

  const gerarFinalDireta = async () => {
    if (!confirm("Gerar a Grande Final Direta?")) return;
    try { 
      await fetch('/api/torneios/fases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId, acao: 'gerarFinalDireta' }) }); 
      await carregarDados();
    } catch { alert("Falha na conexão."); }
  };

  const gerarFinais = async () => {
    if (!confirm("Gerar Finais?")) return;
    try { 
      await fetch('/api/torneios/fases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId, acao: 'gerarFinais' }) }); 
      await carregarDados();
    } catch { alert("Falha na conexão."); }
  };

  const encerrarCampeonatoPontosCorridos = async () => {
    if (!confirm("Tem a certeza que deseja encerrar o torneio?")) return;
    try { 
      await fetch('/api/torneios/fases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ torneioId, acao: 'encerrarCampeonatoPontosCorridos' }) }); 
      await carregarDados();
    } catch { alert("Falha na conexão."); }
  };

  const abrirEdicao = (p: Partida) => {
    setPartidaEditando(p.id); setEditPontosA(p.pontosA); setEditPontosB(p.pontosB);
    setEditSetsA(p.setsVencidosA || 0); setEditSetsB(p.setsVencidosB || 0);
    setEditMestreTimeA(p.timeA.id); setEditMestreTimeB(p.timeB.id); 
    setEditMestreStatus(p.status); setEditHorario(p.horario);
    setEditParciais(p.parciais || '');
  };

  const salvarEdicao = async (jogoId: string) => {
    const novoTimeA = timesMap[editMestreTimeA];
    const novoTimeB = timesMap[editMestreTimeB];

    ultimoCliqueRef.current = 0;
    placarOtimistaRef.current[jogoId] = { pontosA: editPontosA, pontosB: editPontosB };

    setPartidas(prev => prev.map(p => 
      p.id === jogoId 
        ? {
            ...p,
            pontosA: editPontosA,
            pontosB: editPontosB,
            setsVencidosA: editSetsA,
            setsVencidosB: editSetsB,
            status: editMestreStatus,
            horario: editHorario,
            parciais: editParciais,
            timeA: novoTimeA ? novoTimeA : p.timeA,
            timeB: novoTimeB ? novoTimeB : p.timeB
          }
        : p
    ));

    setPartidaEditando(null);

    await supabase.from('partidas').update({
        pontos_a: editPontosA, pontos_b: editPontosB, 
        sets_vencidos_a: editSetsA, sets_vencidos_b: editSetsB,
        time_a_id: editMestreTimeA, time_b_id: editMestreTimeB, 
        status: editMestreStatus, horario: editHorario,
        parciais: editParciais
    }).eq('id', jogoId);

    await carregarDados();
  };

  const gerarRelatorioELimpar = async () => {
    if (!confirm("Deseja gerar o PDF e APAGAR o torneio da base de dados?")) return;
    window.print();
    setTimeout(async () => {
      try { await supabase.from('torneios').delete().eq('id', torneioId); alert("Torneio excluído com sucesso!"); router.push('/setup'); } 
      catch { alert("Erro."); }
    }, 1000);
  };

  const baixarQRCode = async () => {
    const urlApi = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(urlAtual)}`;
    try {
      const response = await fetch(urlApi); const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = blobUrl; a.download = `QR-Code.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(blobUrl);
    } catch { alert('Erro ao descarregar.'); }
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
    editParciais, setEditParciais,
    urlAtual, jogoAtual, proximoJogo, isInvertido,
    handleLogin, fazerLogout, atualizarNomeEquipe, handleUploadLogoGlobal, atualizarChaveEquipe,
    iniciarPartida, atualizarPlacar, recalcularTabela: () => {}, abrirEdicao, salvarEdicao, encerrarAcao,
    gerarTabelaDinamica, gerarSemifinais, gerarFinalDireta, gerarFinais, encerrarCampeonatoPontosCorridos,
    gerarRelatorioELimpar, baixarQRCode, compartilharLink
  };
}